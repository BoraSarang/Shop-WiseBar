# 관심 상품 라우터 — 관심 CRUD + 폴링 알림 (가격 하락 감지)
# PLATFORM: server
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Alert, Device, PricePoint, Product, Watch
from app.schemas import AlertHistoryOut, AlertOut, AlertRecordIn, WatchIn, WatchOut

router = APIRouter(tags=["watches"])


def _get_device_or_404(db: Session, device_id: str) -> Device:
    device = db.get(Device, device_id)
    if device is None:
        raise HTTPException(status_code=404, detail={"code": "E-SRV-DB-1002", "message": "기기를 찾을 수 없습니다"})
    return device


@router.put("/devices/{device_id}/watches/{product_id}", response_model=WatchOut)
def add_watch(device_id: str, product_id: str, payload: WatchIn, db: Session = Depends(get_db)) -> WatchOut:
    """관심 상품 등록 — 추적 제안 배너의 '추적 시작'"""
    _get_device_or_404(db, device_id)
    if db.get(Product, product_id) is None:
        raise HTTPException(status_code=404, detail={"code": "E-SRV-DB-1001", "message": "상품을 찾을 수 없습니다"})
    watch = db.scalar(select(Watch).where(Watch.device_id == device_id, Watch.product_id == product_id))
    if watch is None:
        watch = Watch(device_id=device_id, product_id=product_id)
        db.add(watch)
    db.commit()
    db.refresh(watch)
    return WatchOut(product_id=watch.product_id, created_at=watch.created_at)


@router.delete("/devices/{device_id}/watches/{product_id}", status_code=204)
def remove_watch(device_id: str, product_id: str, db: Session = Depends(get_db)) -> None:
    _get_device_or_404(db, device_id)
    db.execute(
        delete(Watch).where(Watch.device_id == device_id, Watch.product_id == product_id)
    )
    db.commit()


@router.get("/devices/{device_id}/watches", response_model=list[WatchOut])
def list_watches(device_id: str, db: Session = Depends(get_db)) -> list[WatchOut]:
    """관심 상품 목록 (상품명/url/최신 가격 포함)"""
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
                created_at=w.created_at,
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
    """폴링 알림 — since 이후 마지막 가격이 이전 가격 대비 하락한 관심 상품 목록
    since 경계: since 이전 마지막 포인트를 previous로 사용 (T-59 — 재실행 시 1건만 변동이어도 감지)"""
    _get_device_or_404(db, device_id)
    watches = db.scalars(select(Watch).where(Watch.device_id == device_id)).all()
    alerts: list[AlertOut] = []
    for w in watches:
        latest: PricePoint | None = None
        previous: PricePoint | None = None
        if since is not None:
            latest = db.scalar(
                select(PricePoint)
                .where(PricePoint.product_id == w.product_id, PricePoint.captured_at >= since)
                .order_by(PricePoint.captured_at.desc())
                .limit(1)
            )
            if latest is not None:
                previous = db.scalar(
                    select(PricePoint)
                    .where(PricePoint.product_id == w.product_id, PricePoint.captured_at < since)
                    .order_by(PricePoint.captured_at.desc())
                    .limit(1)
                )
        else:
            points = list(
                db.scalars(
                    select(PricePoint)
                    .where(PricePoint.product_id == w.product_id)
                    .order_by(PricePoint.captured_at.desc())
                    .limit(2)
                ).all()
            )
            latest = points[0] if points else None
            previous = points[1] if len(points) > 1 else None
        if latest is None:
            continue
        if previous is not None and latest.price < previous.price:
            alerts.append(
                AlertOut(
                    product_id=w.product_id,
                    alert_type="price_dropped",
                    price=latest.price,
                    previous_price=previous.price,
                    captured_at=latest.captured_at,
                )
            )
    return alerts
