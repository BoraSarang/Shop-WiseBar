# 상품 라우터 — 상품 조회/등록(upsert) + 가격 업로드 + 가격 이력
# PLATFORM: server
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Device, PricePoint, Product, Watch
from app.schemas import PricePointOut, PriceUploadIn, ProductOut, ProductUpsertIn

router = APIRouter(tags=["products"])


def _product_stats(db: Session, product_id: str) -> tuple[int | None, int | None, int, int]:
    """가격 통계 (전 기록 기준) + 추적 기기 수 — 인기/최저가 배지 지표"""
    min_price = db.scalar(select(func.min(PricePoint.price)).where(PricePoint.product_id == product_id))
    avg_price = db.scalar(select(func.avg(PricePoint.price)).where(PricePoint.product_id == product_id))
    price_count = db.scalar(select(func.count(PricePoint.id)).where(PricePoint.product_id == product_id))
    watch_count = db.scalar(select(func.count(Watch.id)).where(Watch.product_id == product_id))
    return (
        int(min_price) if min_price is not None else None,
        round(float(avg_price)) if avg_price is not None else None,
        price_count or 0,
        watch_count or 0,
    )


def _product_out(product: Product, db: Session, device_id: str | None = None) -> ProductOut:
    is_watched = False
    if device_id:
        watch = db.scalar(
            select(Watch).where(Watch.device_id == device_id, Watch.product_id == product.id)
        )
        if watch:
            is_watched = True
    min_price, avg_price, price_count, watch_count = _product_stats(db, product.id)
    return ProductOut(
        product_id=product.id,
        mall=product.mall,
        url=product.url,
        name=product.name,
        image=product.image,
        last_price=product.last_price,
        last_checked_at=product.last_checked_at,
        is_watched=is_watched,
        min_price=min_price,
        avg_price=avg_price,
        price_count=price_count,
        watch_count=watch_count,
    )


@router.get("/products/{product_id}", response_model=ProductOut)
def get_product(product_id: str, device_id: str | None = None, db: Session = Depends(get_db)) -> ProductOut:
    """브라우저 캐치 → 서버 조회 (관심 여부 포함). 없으면 404 — 클라이언트가 등록 요청"""
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail={"code": "E-SRV-DB-1001", "message": "상품을 찾을 수 없습니다"})
    return _product_out(product, db, device_id)


@router.post("/products", response_model=ProductOut, status_code=201)
def upsert_product(payload: ProductUpsertIn, device_id: str | None = None, db: Session = Depends(get_db)) -> ProductOut:
    """클라이언트가 캐치한 상품 등록/정보 업데이트 (name/image 최신화)"""
    # 프로토콜-상대 URL("//cdn...") → https: 정규화 (팝업/확장 페이지에서 로드 가능하도록)
    image = payload.image
    if image and image.startswith("//"):
        image = f"https:{image}"
    product = db.get(Product, payload.product_id)
    if product is None:
        product = Product(
            id=payload.product_id,
            mall=payload.mall,
            url=payload.url,
            name=payload.name,
            image=image,
        )
        db.add(product)
    else:
        # 이름은 최초 1회만 저장 — 쿠팡은 옵션(itemId)별 og:title이 달라
        # 같은 상품인데 이름이 옵션에 따라 바뀌는 것을 방지
        if not product.name and payload.name:
            product.name = payload.name
        if image:
            product.image = image
        if payload.mall:
            product.mall = payload.mall
    db.commit()
    db.refresh(product)
    return _product_out(product, db, device_id)


@router.post("/products/{product_id}/prices", response_model=PricePointOut, status_code=201)
def upload_price(product_id: str, payload: PriceUploadIn, db: Session = Depends(get_db)) -> PricePointOut:
    """가격 수집 결과 업로드 (클라이언트 브라우저 세션 / 서버 크롤러) — last_price 최신화
    variant(쿠팡 itemId)로 옵션별 가격을 분리 저장 — 옵션 간 가격 차이가 하락 오탐을 내지 않도록"""
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail={"code": "E-SRV-DB-1001", "message": "상품을 찾을 수 없습니다"})
    now = datetime.now(timezone.utc)
    point = PricePoint(product_id=product_id, price=payload.price, source=payload.source, variant=payload.variant, captured_at=now)
    db.add(point)
    product.last_price = payload.price
    product.last_checked_at = now
    db.commit()
    db.refresh(point)
    return PricePointOut(price=point.price, source=point.source, variant=point.variant, captured_at=point.captured_at)


@router.get("/products/{product_id}/prices", response_model=list[PricePointOut])
def get_prices(product_id: str, limit: int = 200, db: Session = Depends(get_db)) -> list[PricePointOut]:
    """가격 이력 (그래프용, 최신순 limit개)"""
    points = db.scalars(
        select(PricePoint)
        .where(PricePoint.product_id == product_id)
        .order_by(PricePoint.captured_at.desc())
        .limit(limit)
    ).all()
    return [
        PricePointOut(price=p.price, source=p.source, captured_at=p.captured_at)
        for p in reversed(points)
    ]
