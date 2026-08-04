# 상품 라우터 — 상품 조회/등록(upsert) + 가격 업로드 + 가격 이력
# PLATFORM: server
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Device, PriceDailyStat, PricePoint, Product, Watch
from app.schemas import PricePointOut, PriceUploadIn, ProductOut, ProductUpsertIn

router = APIRouter(tags=["products"])


def _product_stats(db: Session, product_id: str, variant: str | None = None) -> tuple[int | None, int | None, int, int]:
    """가격 통계 + 추적 기기 수 — v0.8.19: variant(쿠팡 수량 묶음/딜) 지정 시 그 variant만
    (지정 없으면 전체 = 기존 동작, 네이버/올리브는 variant가 없어 그대로 유효)"""
    cond = [PricePoint.product_id == product_id]
    if variant is not None:
        cond.append(PricePoint.variant == variant)
    min_price = db.scalar(select(func.min(PricePoint.price)).where(*cond))
    avg_price = db.scalar(select(func.avg(PricePoint.price)).where(*cond))
    price_count = db.scalar(select(func.count(PricePoint.id)).where(*cond))
    watch_count = db.scalar(select(func.count(Watch.id)).where(Watch.product_id == product_id))
    return (
        int(min_price) if min_price is not None else None,
        round(float(avg_price)) if avg_price is not None else None,
        price_count or 0,
        watch_count or 0,
    )


def _variant_last_price(db: Session, product_id: str, variant: str | None) -> int | None:
    """variant별 최신 가격 — v0.8.19: 팝업/추이 배지가 현재 탭의 수량 옵션 가격 기준으로
    표시되도록 (오리온 1개=9,880/2개=20,530/3개=27,530 혼합 방지)"""
    if variant is None:
        return None
    newest = db.scalar(
        select(PricePoint.price)
        .where(PricePoint.product_id == product_id, PricePoint.variant == variant)
        .order_by(PricePoint.captured_at.desc())
        .limit(1)
    )
    return newest


def _product_out(
    product: Product, db: Session, device_id: str | None = None, variant: str | None = None
) -> ProductOut:
    is_watched = False
    if device_id:
        watch = db.scalar(
            select(Watch).where(Watch.device_id == device_id, Watch.product_id == product.id)
        )
        if watch:
            is_watched = True
    min_price, avg_price, price_count, watch_count = _product_stats(db, product.id, variant)
    last_price = _variant_last_price(db, product.id, variant) or product.last_price
    return ProductOut(
        product_id=product.id,
        mall=product.mall,
        url=product.url,
        name=product.name,
        image=product.image,
        last_price=last_price,
        last_checked_at=product.last_checked_at,
        is_watched=is_watched,
        min_price=min_price,
        avg_price=avg_price,
        price_count=price_count,
        watch_count=watch_count,
    )


@router.get("/products", response_model=list[ProductOut])
def list_products(limit: int = 30, db: Session = Depends(get_db)) -> list[ProductOut]:
    """최근 수집 순 상품 목록 (관리/검증용)"""
    products = db.scalars(
        select(Product)
        .order_by(Product.created_at.desc(), Product.id.desc())
        .limit(limit)
    ).all()
    return [_product_out(p, db) for p in products]


@router.get("/products/{product_id}", response_model=ProductOut)
def get_product(
    product_id: str, device_id: str | None = None, variant: str | None = None, db: Session = Depends(get_db)
) -> ProductOut:
    """브라우저 캐치 → 서버 조회 (관심 여부 포함). 없으면 404 — 클라이언트가 등록 요청
    v0.8.19: variant(쿠팡 수량 옵션) 지정 시 해당 variant의 가격/통계로 응답"""
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail={"code": "E-SRV-DB-1001", "message": "상품을 찾을 수 없습니다"})
    return _product_out(product, db, device_id, variant)


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
        # v0.8.17: 상세 페이지 캡처(source=detail)의 실시간 이름(.product-title)은 항상
        #          갱신 — 쿠팡 수량 옵션 변경 시 상품명이 "1개/2개/3개"로 바뀌는데
        #          최초 1회만 저장하면 팝업/추이/찜 목록에 옛 이름("1개")이 남는 문제
        # v0.8.18: 카드 캡처(source=card, 검색/연관 카드의 짧은 이름)는 최초 1회만 —
        #          카드 이름이 상세 페이지 이름을 덮어쓰는 회귀 방지 (네이버/올리브 포함)
        if payload.name and (payload.source == "detail" or not product.name):
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
    variant(쿠팡 itemId)로 옵션별 가격을 분리 저장 — 옵션 간 가격 차이가 하락 오탐을 내지 않도록

    v0.6.0 — 로우 데이터 dedup + 일별 통계:
      - 같은 variant의 직전 가격과 같으면 price_points INSERT 생략 (가격 변화 시점만 로우 기록)
      - 방문(수집)은 항상 price_daily_stats 당일 행에 집계 (open/close/low/high/point_count)"""
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail={"code": "E-SRV-DB-1001", "message": "상품을 찾을 수 없습니다"})
    # 초 단위 절단: UNIQUE(product_id, captured_at)가 같은 초 중복(동시 캡처)을 막는 방어선이 되도록
    now = datetime.now(timezone.utc).replace(microsecond=0)
    today = now.date()

    variant_cond = PricePoint.variant.is_(None) if payload.variant is None else PricePoint.variant == payload.variant
    last = db.scalar(
        select(PricePoint)
        .where(PricePoint.product_id == product_id, variant_cond)
        .order_by(PricePoint.captured_at.desc())
        .limit(1)
    )

    # dedup: 가격 변화 없으면 로우 INSERT 생략, 통계만 갱신
    inserted = False
    if last is None or last.price != payload.price:
        point = PricePoint(
            product_id=product_id, price=payload.price, source=payload.source,
            variant=payload.variant, captured_at=now,
        )
        db.add(point)
        try:
            db.flush()
            inserted = True
        except IntegrityError:
            # 같은 초에 이미 저장된 동시 캡처(중복 POST) — 기존 행 유지, 통계만 갱신
            db.rollback()

    product.last_price = payload.price
    product.last_checked_at = now

    # 일별 통계 upsert
    stat = db.scalar(
        select(PriceDailyStat)
        .where(PriceDailyStat.product_id == product_id, PriceDailyStat.stat_date == today)
    )
    if stat is None:
        stat = PriceDailyStat(
            product_id=product_id, stat_date=today,
            open_price=payload.price, close_price=payload.price,
            low_price=payload.price, high_price=payload.price,
            point_count=1, updated_at=now,
        )
        db.add(stat)
    else:
        stat.close_price = payload.price
        stat.low_price = min(stat.low_price, payload.price)
        stat.high_price = max(stat.high_price, payload.price)
        stat.point_count += 1
        stat.updated_at = now

    db.commit()
    if not inserted:
        return PricePointOut(price=payload.price, source=payload.source, variant=payload.variant, captured_at=now)
    db.refresh(point)
    return PricePointOut(price=point.price, source=point.source, variant=point.variant, captured_at=point.captured_at)


@router.get("/products/{product_id}/prices", response_model=list[PricePointOut])
def get_prices(
    product_id: str, limit: int = 200, variant: str | None = None, db: Session = Depends(get_db)
) -> list[PricePointOut]:
    """가격 이력 (그래프용, 최신순 limit개) — v0.8.19: variant 지정 시 해당 variant만
    (추이 그래프가 현재 탭의 수량 옵션 가격만 그리도록)"""
    cond = [PricePoint.product_id == product_id]
    if variant is not None:
        cond.append(PricePoint.variant == variant)
    points = db.scalars(
        select(PricePoint)
        .where(*cond)
        .order_by(PricePoint.captured_at.desc())
        .limit(limit)
    ).all()
    return [
        PricePointOut(price=p.price, source=p.source, variant=p.variant, captured_at=p.captured_at)
        for p in reversed(points)
    ]


@router.delete("/products/{product_id}/prices/{price}")
def delete_price_points(product_id: str, price: int, db: Session = Depends(get_db)) -> dict:
    """관리용: 이상값/오탐 가격 포인트 일괄 삭제 (동일 가격 전체)"""
    result = db.execute(
        delete(PricePoint).where(
            PricePoint.product_id == product_id,
            PricePoint.price == price,
        )
    )
    # v0.8.16: 삭제된 값이 last_price였다면 최근 남은 포인트로 복구 —
    #          오염 포인트 삭제 후에도 팝업(서버 last_price 표시)이 삭제값을
    #          계속 보여주던 문제 (오리온 24,200원 사례) 방지
    product = db.get(Product, product_id)
    if product is not None and product.last_price == price:
        newest = db.scalar(
            select(PricePoint)
            .where(PricePoint.product_id == product_id)
            .order_by(PricePoint.captured_at.desc())
            .limit(1)
        )
        product.last_price = newest.price if newest is not None else None
    db.commit()
    return {"product_id": product_id, "price": price, "deleted": result.rowcount}
