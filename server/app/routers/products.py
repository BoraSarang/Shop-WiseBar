# 상품 라우터 — 상품 조회/등록(upsert) + 가격 업로드 + 가격 이력
# PLATFORM: server
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.datetimeutil import KST, kst_date
from app.models import (
    Alert,
    Device,
    PriceDailyStat,
    PricePoint,
    Product,
    ProductRelation,
    Watch,
)
from app.schemas import (
    BatchItemIn,
    PricePointOut,
    PriceStatsOut,
    PriceUploadIn,
    ProductAlternativeOut,
    ProductBatchIn,
    ProductBatchOut,
    ProductOut,
    ProductUpsertIn,
    SoldOutIn,
)
from app.services.name_normalizer import normalize

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


def _match_alternatives(db: Session, product: Product) -> list[ProductAlternativeOut]:
    """동일 상품(정규화명 동일) 다른 몰 + 가격 근접 상품 (v0.13.0, T-107).
    내 상품 기준 diff_percent = (내 가격 - 상대 가격)/상대 가격 × 100 (양수 = 상대가 더 저렴)."""
    if not product.normalized_name or not product.last_price:
        return []
    rival_price = product.last_price
    lo = int(rival_price * 0.7)  # ±30%
    hi = int(rival_price * 1.3)
    rows = db.scalars(
        select(Product)
        .where(
            Product.normalized_name == product.normalized_name,
            Product.mall != product.mall,
            Product.last_price.is_not(None),
            Product.last_price >= lo,
            Product.last_price <= hi,
        )
        .order_by(Product.last_price.asc())
        .limit(6)
    ).all()
    if not rows:
        return []
    ids = [r.id for r in rows]
    wc = dict(
        db.execute(select(Watch.product_id, func.count(Watch.id)).where(Watch.product_id.in_(ids)).group_by(Watch.product_id)).all()
    )
    out: list[ProductAlternativeOut] = []
    seen_malls: set[str] = set()
    for r in rows:
        if r.mall in seen_malls:
            continue
        seen_malls.add(r.mall)
        if r.last_price is None:
            continue
        diff = round((rival_price - r.last_price) / r.last_price * 100)
        out.append(
            ProductAlternativeOut(
                product_id=r.id,
                mall=r.mall,
                name=r.name,
                image=r.image,
                url=r.url,
                last_price=r.last_price,
                watch_count=wc.get(r.id, 0),
                diff_percent=diff,
            )
        )
    return out[:3]


def _product_out(
    product: Product, db: Session, device_id: str | None = None, variant: str | None = None,
    with_alternatives: bool = True,
) -> ProductOut:
    is_watched = False
    target_price: int | None = None
    if device_id:
        watch = db.scalar(
            select(Watch).where(Watch.device_id == device_id, Watch.product_id == product.id)
        )
        if watch:
            is_watched = True
            target_price = watch.target_price  # v0.9.1 — 팝업 목표가 입력창 초기값
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
        sold_out=product.sold_out_at is not None,
        is_watched=is_watched,
        target_price=target_price,
        min_price=min_price,
        avg_price=avg_price,
        price_count=price_count,
        watch_count=watch_count,
        alternatives=_match_alternatives(db, product) if with_alternatives else [],
    )


def _backfill_normalized_names(db: Session) -> int:
    """v0.13.0 (T-106) — 기존 상품의 normalized_name이 NULL이거나 이름이 갱신된 경우 재계산.
    startup 시 1회 호출 (운영 규모 수 백~수천 — 배치로 무리 없음)."""
    rows = db.scalars(
        select(Product).where(
            Product.name.is_not(None),
            (Product.normalized_name.is_(None)) | (Product.normalized_name == ""),
        )
    ).all()
    updated = 0
    for p in rows:
        norm = normalize(p.name)
        if norm != p.normalized_name:
            p.normalized_name = norm or None
            updated += 1
    return updated


@router.get("/products", response_model=list[ProductOut])
def list_products(limit: int = 30, db: Session = Depends(get_db)) -> list[ProductOut]:
    """최근 수집 순 상품 목록 (관리/검증용)"""
    products = db.scalars(
        select(Product)
        .order_by(Product.created_at.desc(), Product.id.desc())
        .limit(limit)
    ).all()
    return [_product_out(p, db, with_alternatives=False) for p in products]


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


def _insight_badges(db: Session, product: Product, variant: str | None, last7: PriceStatsOut.PeriodStats) -> list[str]:
    """구매 타이밍 인사이트 (v0.13.0, T-109) — 현재가 기준:
      - "역대 최저가 달성": last_price == 전체 최저
      - "평균보다 N% 저렴": last_price < 전체 평균
      - "7일 최저가 도달": last_price == 지난 7일 최저
    데이터 3포인트 미만이면 판단 불가 → 빈 리스트 (데이터 쌓는 동안 추가 배지 없음)."""
    if product.last_price is None:
        return []
    cur = product.last_price
    cond = [PricePoint.product_id == product.id]
    if variant is not None:
        cond.append(PricePoint.variant == variant)
    data_points = db.scalar(select(func.count(PricePoint.id)).where(*cond))
    if data_points < 3:
        return []
    badges: list[str] = []
    o_min = db.scalar(select(func.min(PricePoint.price)).where(*cond))
    o_avg = db.scalar(select(func.avg(PricePoint.price)).where(*cond))
    if o_min is not None and cur <= o_min:
        badges.append("역대 최저가 달성")
    elif o_avg is not None and cur < o_avg:
        pct = ((o_avg - cur) / o_avg) * 100
        badges.append(f"평균보다 {pct:.0f}% 저렴")
    if last7.min is not None and cur <= last7.min:
        badges.append("7일 최저가 도달")
    return badges


@router.get("/products/{product_id}/stats", response_model=PriceStatsOut)
def get_product_stats(
    product_id: str, variant: str | None = None, db: Session = Depends(get_db)
) -> PriceStatsOut:
    """가격 통계 요약 (v0.10.0) — price_daily_stats 기반 7일/30일/역대 min·avg·min_date.
    추이 그래프가 variant 지정 시 해당 variant만 그리므로, stats도 동일하게 variant 조건 지원.
    variant 없음 = 상품 전체(네이버/올리브영은 variant가 없어 전체가 곧 유일)."""
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail={"code": "E-SRV-DB-1001", "message": "상품을 찾을 수 없습니다"})

    # variant가 price_points에 저장되고 price_daily_stats에는 variant가 없으므로,
    # variant 지정 시 price_daily_stats로는 variant 분리가 불가능 → price_points에서 집계한다.
    # (쿠팡 variant 가격이 일별 통계에 뒤섞여 분리 집계가 필요한 경우)
    today = kst_date()  # v0.12.2 (T-102) — 통계 기간 경계를 KST 날짜 기준으로
    cutoff7 = today - timedelta(days=7)
    cutoff30 = today - timedelta(days=30)
    epoch = date(1970, 1, 1)

    def period_stats(cutoff: date) -> PriceStatsOut.PeriodStats:
        """기간(포함) 내 최저가·최저가 날짜·평균. variant 있으면 price_points, 없으면
        price_daily_stats(low_price) 기준 — 방문 dedup 정책(가격 로우는 변경 시만)과 일관."""
        if variant is not None:
            pcond = [
                PricePoint.product_id == product_id,
                PricePoint.variant == variant,
                PricePoint.captured_at >= datetime.combine(cutoff, datetime.min.time(), KST),
            ]
            pmin = db.scalar(select(func.min(PricePoint.price)).where(*pcond))
            pmin_at = None
            if pmin is not None:
                pmin_at = db.scalar(
                    select(func.min(PricePoint.captured_at))
                    .where(*pcond, PricePoint.price == pmin)
                )
            pavg = db.scalar(select(func.avg(PricePoint.price)).where(*pcond))
            return PriceStatsOut.PeriodStats(
                min=int(pmin) if pmin is not None else None,
                min_date=kst_date(pmin_at) if pmin_at is not None else None,
                avg=round(float(pavg)) if pavg is not None else None,
            )

        dcond = [PriceDailyStat.product_id == product_id, PriceDailyStat.stat_date >= cutoff]
        dmin = db.scalar(select(func.min(PriceDailyStat.low_price)).where(*dcond))
        dmin_date = None
        if dmin is not None:
            dmin_date = db.scalar(
                select(PriceDailyStat.stat_date)
                .where(*dcond, PriceDailyStat.low_price == dmin)
                .order_by(PriceDailyStat.stat_date)
                .limit(1)
            )
        davg = db.scalar(select(func.avg(PriceDailyStat.low_price)).where(*dcond))
        return PriceStatsOut.PeriodStats(
            min=int(dmin) if dmin is not None else None,
            min_date=dmin_date if dmin_date is not None else None,
            avg=round(float(davg)) if davg is not None else None,
        )

    return PriceStatsOut(
        period7=period_stats(cutoff7), period30=period_stats(cutoff30), overall=period_stats(epoch),
        insight_badges=_insight_badges(db, product, variant, last7=period_stats(cutoff7)),
    )


@router.post("/products", response_model=ProductOut, status_code=201)
def upsert_product(payload: ProductUpsertIn, device_id: str | None = None, db: Session = Depends(get_db)) -> ProductOut:
    """클라이언트가 캐치한 상품 등록/정보 업데이트 (name/image 최신화)"""
    product = _upsert(db, payload.product_id, payload.mall, payload.url, payload.name, payload.image, payload.source)
    db.commit()
    return _product_out_basic(product)


# v0.10.4 (T-93) — 단일 상품 upsert 코어. 배치에서도 재사용 (트랜잭션 커밋은 호출자가)
def _upsert(db: Session, product_id: str, mall: str, url: str, name: str | None,
            image: str | None, source: str | None) -> Product:
    # v0.9.3 — DB 컬럼 최대 길이(Postgres는 초과 시 IntegrityError 500, SQLite는 무시)에
    #          맞춰 잘라 저장한다. 네이버 연관 카드의 장황한 상품명이 name(512)을 넘는 경우
    #          '연관 상품 업로드 실패 HTTP 500' + 관계 저장 누락이 발생했었음
    url = (url or "")[:1024]
    name = (name or "")[:512]
    image = (image or "")[:1024]
    # v0.13.0 (T-106) — 상품명 정규화 (크로스몰 매칭용). name 변경 시 재계산
    normalized_name = normalize(name) if name else None
    # 프로토콜-상대 URL("//cdn...") → https: 정규화 (팝업/확장 페이지에서 로드 가능하도록)
    if image and image.startswith("//"):
        image = f"https:{image}"
    product = db.get(Product, product_id)
    if product is None:
        product = Product(
            id=product_id,
            mall=mall,
            url=url,
            name=name,
            normalized_name=normalized_name,
            image=image,
        )
        db.add(product)
    else:
        # v0.8.17: 상세 페이지 캡처(source=detail)의 실시간 이름(.product-title)은 항상
        #          갱신 — 쿠팡 수량 옵션 변경 시 상품명이 "1개/2개/3개"로 바뀌는데
        #          최초 1회만 저장하면 팝업/추이/찜 목록에 옛 이름("1개")이 남는 문제
        # v0.8.18: 카드 캡처(source=card, 검색/연관 카드의 짧은 이름)는 최초 1회만 —
        #          카드 이름이 상세 페이지 이름을 덮어쓰는 회귀 방지 (네이버/올리브 포함)
        if name and (source == "detail" or not product.name):
            product.name = name
            product.normalized_name = normalized_name
        elif not product.normalized_name and normalized_name:
            product.normalized_name = normalized_name  # 기존 데이터 백필 (이름 유지)
        if image:
            product.image = image
        if mall:
            product.mall = mall
    return product


# v0.10.4 (T-93) — 가격 저장 코어. 배치에서도 재사용. 커밋은 호출자가.
# 개별 upload_price와 동일 dedup/통계 로직 — 단, IntegrityError(같은 초 다른 가격)는
# 배치에서 항목 단위 스킵으로 처리되므로 여기서는 재시도하지 않고 그대로 propagate.
# T-95a (v0.10.4 후속): db.get 재조회 제거 — SessionLocal은 autoflush=False라 batch에서
# _upsert가 방금 add한(pending) Product를 재조회하면 None → AttributeError 500 (가격 dedup 시 항상).
# T-95b: captured_at 파라미터 추가 — upload_price의 +1s 재시도가 코어 재사용 (별도 중복 제거)
def _apply_price(db: Session, product: Product, price: int, source: str, variant: str | None,
                 captured_at: datetime | None = None) -> None:
    now = captured_at or datetime.now(timezone.utc).replace(microsecond=0)
    today = kst_date(now)  # v0.12.2 (T-102) — 일(daily) 경계를 KST 기준으로 (확장 그래프와 일치)
    variant_cond = PricePoint.variant.is_(None) if variant is None else PricePoint.variant == variant
    last = db.scalar(
        select(PricePoint)
        .where(PricePoint.product_id == product.id, variant_cond)
        .order_by(PricePoint.captured_at.desc())
        .limit(1)
    )
    if last is None or last.price != price:
        point = PricePoint(
            product_id=product.id, price=price, source=source,
            variant=variant, captured_at=now,
        )
        db.add(point)
        db.flush()  # UNIQUE 충돌 시 IntegrityError propagate
    product.last_price = price
    product.last_checked_at = now
    if product.sold_out_at is not None:
        product.sold_out_at = None  # v0.9.1 — 가격 캡처 = 판매 중 → 품절 자동 해제
    stat = db.scalar(
        select(PriceDailyStat)
        .where(PriceDailyStat.product_id == product.id, PriceDailyStat.stat_date == today)
    )
    if stat is None:
        stat = PriceDailyStat(
            product_id=product.id, stat_date=today,
            open_price=price, close_price=price,
            low_price=price, high_price=price,
            point_count=1, updated_at=now,
        )
        db.add(stat)
    else:
        stat.close_price = price
        stat.low_price = min(stat.low_price, price)
        stat.high_price = max(stat.high_price, price)
        stat.point_count += 1
        stat.updated_at = now


def _product_out_basic(product: Product) -> ProductOut:
    """v0.9.4 — 무거운 통계 쿼리(_product_out) 생략 — 업로드/배치는 기본 필드만 반환"""
    return ProductOut(
        product_id=product.id,
        mall=product.mall,
        url=product.url,
        name=product.name,
        image=product.image,
        last_price=product.last_price,
        last_checked_at=product.last_checked_at,
        sold_out=product.sold_out_at is not None,
    )


@router.post("/products/batch", response_model=ProductBatchOut, status_code=201)
def upsert_batch(payload: ProductBatchIn, db: Session = Depends(get_db)) -> ProductBatchOut:
    """연관 상품 일괄 업로드 (v0.10.4, T-93) — 개별 POST /products + /prices를 1요청으로.
    확장이 연관 카드 40개를 개별 요청 80개로 보내 서버가 과부하되는 것을 해결.
    단일 트랜잭션으로 커밋하고, 항목별 예외(중복/동시 캡처 등)는 그 항목만 스킵(부분 실패 허용)."""
    upserted = 0
    price_count = 0
    items: list[ProductOut] = []
    seen: set[str] = set()
    for item in payload.items:
        if item.product_id in seen:  # 같은 요청 내 중복 product_id는 첫 건만 (연관 카드 중복)
            continue
        seen.add(item.product_id)
        # savepoint(begin_nested) — 항목 단위 격리. 실패 시 이 항목만 롤백되고
        # 이전에 성공한 항목은 보존 (단일 트랜잭션 커밋 유지)
        with db.begin_nested():
            try:
                product = _upsert(db, item.product_id, item.mall, item.url, item.name, item.image, item.source)
                if item.price and item.price > 0:
                    _apply_price(db, product, item.price, item.source or "extension", None)
                    price_count += 1
                items.append(_product_out_basic(product))
                upserted += 1
            except IntegrityError:
                pass  # 이 항목 스킵 — 나머지 진행 (다음 수집 시 재시도)
    db.commit()
    return ProductBatchOut(upserted=upserted, price_count=price_count, items=items)


@router.post("/products/{product_id}/prices", response_model=PricePointOut, status_code=201)
def upload_price(product_id: str, payload: PriceUploadIn, db: Session = Depends(get_db)) -> PricePointOut:
    """가격 수집 결과 업로드 (클라이언트 브라우저 세션 / 서버 크롤러) — last_price 최신화
    variant(쿠팡 itemId)로 옵션별 가격을 분리 저장 — 옵션 간 가격 차이가 하락 오탐을 내지 않도록

    v0.6.0 — 로우 데이터 dedup + 일별 통계:
      - 같은 variant의 직전 가격과 같으면 price_points INSERT 생략 (가격 변화 시점만 로우 기록)
      - 방문(수집)은 항상 price_daily_stats 당일 행에 집계 (open/close/low/high/point_count)
    v0.10.1 — 같은 초 다른 가격은 +1s 밀어 저장 (UNIQUE 충돌 시 가격 유실 방지)
    T-95b — dedup/통계는 _apply_price 코어로 통합 (개별·배치 동일 로직)"""
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail={"code": "E-SRV-DB-1001", "message": "상품을 찾을 수 없습니다"})
    now = payload.captured_at or datetime.now(timezone.utc).replace(microsecond=0)
    try:
        _apply_price(db, product, payload.price, payload.source, payload.variant, captured_at=now)
    except IntegrityError:
        # UNIQUE(product_id, captured_at) 충돌 — 같은 초에 다른 가격이 먼저 저장됨.
        # v0.9.4 — PostgreSQL은 flush 실패 후 세션이 requires-rollback 상태가 되므로
        #          rollback 없이 commit을 이어가면 500. 즉시 rollback 후 재시도가 안전.
        # 같은 가격 dedup은 _apply_price에서 이미 거름 → 여기 도달한 충돌은 "다른 가격"이다.
        # 같은 초 아래에서 UNIQUE를 통과하려면 1초 뒤로 밀어 저장한다 (가격 유실 방지).
        db.rollback()
        # rollback으로 expire된 product를 재조회 (None이면 실서버에서 삭제된 경우 — 그대로 500)
        product = db.get(Product, product_id)
        if product is None:
            raise
        now = now + timedelta(seconds=1)
        _apply_price(db, product, payload.price, payload.source, payload.variant, captured_at=now)
    db.commit()
    return PricePointOut(price=payload.price, source=payload.source, variant=payload.variant, captured_at=now)


@router.post("/products/{product_id}/sold-out")
def update_sold_out(product_id: str, payload: SoldOutIn, db: Session = Depends(get_db)) -> dict:
    """품절 상태 갱신 (v0.9.1) — 확장이 품절/재판매 감지 시 호출.
    품절이면 sold_out_at 시작 시각 기록, 재판매면 해제 (가격 업로드 시에도 자동 해제)"""
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail={"code": "E-SRV-DB-1001", "message": "상품을 찾을 수 없습니다"})
    now = datetime.now(timezone.utc)
    if payload.sold_out:
        if product.sold_out_at is None:
            product.sold_out_at = now
    else:
        product.sold_out_at = None
    product.last_checked_at = now
    db.commit()
    return {"product_id": product_id, "sold_out": product.sold_out_at is not None, "sold_out_at": product.sold_out_at}


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
def delete_price_points(
    product_id: str, price: int, variant: str | None = None, db: Session = Depends(get_db)
) -> dict:
    """관리용: 이상값/오탐 가격 포인트 삭제.
    variant 생략 = 해당 가격 전체 / variant 지정 = 해당 variant만 (__none__ = NULL variant)
    v0.8.27: variant=None 품절 잔존값(오리온 9,880원)만 지우고 실제 딜 variant는 보존"""
    cond = [PricePoint.product_id == product_id, PricePoint.price == price]
    if variant is not None:
        cond.append(PricePoint.variant == (None if variant == "__none__" else variant))
    result = db.execute(delete(PricePoint).where(*cond))
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


@router.delete("/products/{product_id}", status_code=204)
def delete_product(product_id: str, db: Session = Depends(get_db)) -> None:
    """상품 전체 삭제 (관리용, T-96a 데모 데이터 정리) — FK 참조 테이블부터 정리 후 삭제.
    watches/alerts는 device와 상품을 동시에 참조하므로 관계 레코드만 삭제."""
    product = db.get(Product, product_id)
    if product is None:
        return  # 이미 없으면 204 (idempotent)
    # 참조 무결성: 자식 테이블부터 삭제 (제품→watch/alert/daily_stat/relation/price_point 순)
    db.execute(delete(Watch).where(Watch.product_id == product_id))
    db.execute(delete(Alert).where(Alert.product_id == product_id))
    db.execute(delete(PriceDailyStat).where(PriceDailyStat.product_id == product_id))
    db.execute(
        delete(ProductRelation).where(
            (ProductRelation.source_product_id == product_id)
            | (ProductRelation.target_product_id == product_id)
        )
    )
    db.execute(delete(PricePoint).where(PricePoint.product_id == product_id))
    db.delete(product)
    db.commit()
