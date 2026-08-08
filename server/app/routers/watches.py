# 관심 상품 라우터 — 관심 CRUD + 폴링 알림 (가격 하락 감지)
# PLATFORM: server
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Alert, Device, PricePoint, Product, Watch
from app.routers.products import _match_alternatives
from app.schemas import AlertHistoryOut, AlertOut, AlertRecordIn, WatchIn, WatchOut

router = APIRouter(tags=["watches"])


def _naive(dt: datetime | None) -> datetime | None:
    """PostgreSQL(aware) / SQLite(naive) 혼용 대응 — 비교 시 항상 naive로 통일 (v0.9.4)
    실서버 DateTime(timezone=True) 컬럼이 aware로 반환돼 naive since와 비교 시 TypeError로 500"""
    return dt.replace(tzinfo=None) if dt is not None and dt.tzinfo is not None else dt


def _get_device_or_404(db: Session, device_id: str) -> Device:
    device = db.get(Device, device_id)
    if device is None:
        raise HTTPException(status_code=404, detail={"code": "E-SRV-DB-1002", "message": "기기를 찾을 수 없습니다"})
    return device


@router.put("/devices/{device_id}/watches/{product_id}", response_model=WatchOut)
def add_watch(device_id: str, product_id: str, payload: WatchIn, db: Session = Depends(get_db)) -> WatchOut:
    """관심 상품 등록 — 추적 제안 배너의 '추적 시작' + 목표가 설정 (v0.9.1)"""
    _get_device_or_404(db, device_id)
    if db.get(Product, product_id) is None:
        raise HTTPException(status_code=404, detail={"code": "E-SRV-DB-1001", "message": "상품을 찾을 수 없습니다"})
    watch = db.scalar(select(Watch).where(Watch.device_id == device_id, Watch.product_id == product_id))
    if watch is None:
        watch = Watch(device_id=device_id, product_id=product_id)
        db.add(watch)
    if payload.target_price is not None:
        watch.target_price = payload.target_price
    else:
        # v0.9.2 — 목표가 해제 (PUT {} / {target_price: null}) — 기존 값 유지가 아니라 명시적 해제
        watch.target_price = None
    db.commit()
    db.refresh(watch)
    return WatchOut(product_id=watch.product_id, target_price=watch.target_price, created_at=watch.created_at)


@router.delete("/devices/{device_id}/watches/{product_id}", status_code=204)
def remove_watch(device_id: str, product_id: str, db: Session = Depends(get_db)) -> None:
    _get_device_or_404(db, device_id)
    db.execute(
        delete(Watch).where(Watch.device_id == device_id, Watch.product_id == product_id)
    )
    db.commit()


@router.get("/devices/{device_id}/watches", response_model=list[WatchOut])
def list_watches(device_id: str, include_alternatives: bool = False, db: Session = Depends(get_db)) -> list[WatchOut]:
    """관심 상품 목록 (상품명/url/최신 가격 포함).
    v0.13.0 (T-107) — include_alternatives=true 시 각 찜 상품에 크로스몰 비교(alternatives) 포함."""
    _get_device_or_404(db, device_id)
    watches = db.scalars(select(Watch).where(Watch.device_id == device_id)).all()
    products = {
        p.id: p
        for p in db.scalars(
            select(Product).where(Product.id.in_([w.product_id for w in watches]))
        ).all()
    }
    out: list[WatchOut] = []
    for w in watches:
        p = products.get(w.product_id)
        out.append(
            WatchOut(
                product_id=w.product_id,
                mall=p.mall if p else None,
                product_name=p.name if p else None,
                url=p.url if p else None,
                image=p.image if p else None,
                last_price=p.last_price if p else None,
                last_checked_at=p.last_checked_at if p else None,
                sold_out=p.sold_out_at is not None if p else False,
                target_price=w.target_price,
                created_at=w.created_at,
                alternatives=_match_alternatives(db, p) if include_alternatives and p else [],
            )
        )
    return out


@router.get("/devices/{device_id}/alerts/history", response_model=list[AlertHistoryOut])
def get_alert_history(device_id: str, limit: int = 50, db: Session = Depends(get_db)) -> list[AlertHistoryOut]:
    """알림 히스토리 — 최신순 limit건 (기본 50, 초과 시 오래된 것 정리)"""
    _get_device_or_404(db, device_id)
    if limit > 50:
        limit = 50
    rows = list(
        db.scalars(
            select(Alert)
            .where(Alert.device_id == device_id)
            .order_by(Alert.created_at.desc(), Alert.id.desc())
            .limit(limit)
        ).all()
    )
    products = {
        p.id: p
        for p in db.scalars(select(Product).where(Product.id.in_([a.product_id for a in rows]))).all()
    }
    stale = db.scalars(
        select(Alert.id)
        .where(Alert.device_id == device_id)
        .order_by(Alert.created_at.desc(), Alert.id.desc())
        .offset(limit)
    ).all()
    if stale:
        db.execute(delete(Alert).where(Alert.id.in_(stale)))
        db.commit()
    return [
        AlertHistoryOut(
            id=a.id,
            product_id=a.product_id,
            product_name=(products.get(a.product_id).name if products.get(a.product_id) else None),
            mall=(products.get(a.product_id).mall if products.get(a.product_id) else None),
            image=(products.get(a.product_id).image if products.get(a.product_id) else None),
            alert_type=a.alert_type,
            price=a.price,
            previous_price=a.previous_price,
            url=a.url,
            created_at=a.created_at,
        )
        for a in rows
    ]


@router.post("/devices/{device_id}/alerts", response_model=list[AlertHistoryOut])
def record_alerts(device_id: str, payload: list[AlertRecordIn], db: Session = Depends(get_db)) -> list[AlertHistoryOut]:
    """폴링 감지 알림 배치 저장 — url은 Product에서 스냅샷"""
    _get_device_or_404(db, device_id)
    products = {
        p.id: p.url
        for p in db.scalars(select(Product).where(Product.id.in_([a.product_id for a in payload]))).all()
    }
    for a in payload:
        db.add(
            Alert(
                device_id=device_id,
                product_id=a.product_id,
                alert_type=a.alert_type,
                price=a.price,
                previous_price=a.previous_price,
                url=products.get(a.product_id),
            )
        )
    db.commit()
    return get_alert_history(device_id, db=db)


@router.delete("/devices/{device_id}/alerts/{alert_id}", status_code=204)
def delete_alert(device_id: str, alert_id: int, db: Session = Depends(get_db)) -> None:
    _get_device_or_404(db, device_id)
    db.execute(delete(Alert).where(Alert.id == alert_id, Alert.device_id == device_id))
    db.commit()


@router.get("/devices/{device_id}/alerts", response_model=list[AlertOut])
def get_alerts(device_id: str, since: datetime | None = None, db: Session = Depends(get_db)) -> list[AlertOut]:
    """폴링 알림 — ①가격 하락(같은 variant끼리만) ②목표가 도달(v0.9.1) ③품절(v0.9.1)
    since는 '신규 보고 캡처' 필터로만 사용 — 직전 가격은 since 이전이어도 비교 기준으로 삼아,
    찜 이후 첫 하락(모든 캡처가 since 이후)도 감지되도록 한다.
    목표가 도달이면 하락 알림 대신 target_reached만 반환 (중복 알림 방지)"""
    _get_device_or_404(db, device_id)
    if since is not None:
        since = _naive(since)
    # T-95c — selectinload로 Product N+1 제거 (watch 수만큼 개별 쿼리 방지, 폴링 성능)
    watches = db.scalars(select(Watch).where(Watch.device_id == device_id).options(selectinload(Watch.product))).all()
    alerts: list[AlertOut] = []
    for w in watches:
        # 품절 감지 (v0.9.1) — since 이후 품절 시작 시 1회 (확장 폴링이 since를 갱신하므로 반복 없음)
        # since=None(최초 폴링)이면 품절 상태 자체를 알림으로 전달
        # 품절 상품은 하락/목표가 검사 자체를 생략 (이전에 알림을 받았어도 재검사 무한 반복 방지)
        if w.product is not None and w.product.sold_out_at is not None:
            sold_out_at = w.product.sold_out_at
            if since is None or _naive(sold_out_at) > since:
                alerts.append(
                    AlertOut(
                        product_id=w.product_id,
                        alert_type="sold_out",
                        price=0,
                        previous_price=None,
                        captured_at=sold_out_at,
                    )
                )
            continue
        points = list(
            db.scalars(
                select(PricePoint)
                .where(PricePoint.product_id == w.product_id)
                .order_by(PricePoint.captured_at.desc())
                .limit(500)
            ).all()
        )
        by_variant: dict[str | None, list[PricePoint]] = {}
        for pt in points:
            by_variant.setdefault(pt.variant, []).append(pt)
        for variant, group in by_variant.items():
            latest = group[0]
            # since는 확장이 갱신한 '이미 본 시각' — 캡처가 같거나 이전이면 스킵 (초 절단 동일 시각 재감지 방지)
            if since is not None and _naive(latest.captured_at) <= since:
                continue
            previous = group[1] if len(group) > 1 else None
            # 목표가 도달 (v0.9.1) — 직전이 이미 목표가 이하(이전 알림 받음)면 반복 방지
            if w.target_price and latest.price <= w.target_price and (previous is None or previous.price > w.target_price):
                alerts.append(
                    AlertOut(
                        product_id=latest.product_id,
                        alert_type="target_reached",
                        price=latest.price,
                        previous_price=previous.price if previous else None,
                        captured_at=latest.captured_at,
                    )
                )
                continue
            if previous is not None and latest.price < previous.price:
                alerts.append(_alert_out(latest, previous))
    return alerts


def _alert_out(latest: PricePoint, previous: PricePoint | None) -> AlertOut:
    return AlertOut(
        product_id=latest.product_id,
        alert_type="price_dropped",
        price=latest.price,
        previous_price=previous.price if previous else None,
        captured_at=latest.captured_at,
    )
