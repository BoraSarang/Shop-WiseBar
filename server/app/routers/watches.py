# 관심 상품 라우터 — 관심 CRUD + 폴링 알림 (하락/목표가 도달 감지)
# PLATFORM: server
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Device, PricePoint, Product, Watch
from app.schemas import AlertOut, WatchIn, WatchOut

router = APIRouter(tags=["watches"])


def _get_device_or_404(db: Session, device_id: str) -> Device:
    device = db.get(Device, device_id)
    if device is None:
        raise HTTPException(status_code=404, detail={"code": "E-SRV-DB-1002", "message": "기기를 찾을 수 없습니다"})
    return device


@router.put("/devices/{device_id}/watches/{product_id}", response_model=WatchOut)
def add_watch(device_id: str, product_id: str, payload: WatchIn, db: Session = Depends(get_db)) -> WatchOut:
    """관심 상품 등록 (목표가 선택) — 추적 제안 배너의 '추적 시작'"""
    _get_device_or_404(db, device_id)
    if db.get(Product, product_id) is None:
        raise HTTPException(status_code=404, detail={"code": "E-SRV-DB-1001", "message": "상품을 찾을 수 없습니다"})
    watch = db.scalar(select(Watch).where(Watch.device_id == device_id, Watch.product_id == product_id))
    if watch is None:
        watch = Watch(device_id=device_id, product_id=product_id, target_price=payload.target_price)
        db.add(watch)
    else:
        watch.target_price = payload.target_price
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
                product_name=p.name if p else None,
                url=p.url if p else None,
                last_price=p.last_price if p else None,
                target_price=w.target_price,
                created_at=w.created_at,
            )
        )
    return out


@router.get("/devices/{device_id}/alerts", response_model=list[AlertOut])
def get_alerts(device_id: str, since: datetime | None = None, db: Session = Depends(get_db)) -> list[AlertOut]:
    """폴링 알림 — since 이후 가격이 (a)목표가 이하 도달 (b)이전 가격 대비 하락한 관심 상품 목록
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
        if w.target_price is not None and latest.price <= w.target_price:
            alerts.append(
                AlertOut(
                    product_id=w.product_id,
                    alert_type="target_reached",
                    price=latest.price,
                    previous_price=previous.price if previous else None,
                    captured_at=latest.captured_at,
                )
            )
        elif previous is not None and latest.price < previous.price:
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
