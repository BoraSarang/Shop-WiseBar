# 관리자(Admin) 조회 라우터 — macOS ShopWiseBarManager 앱용 집계 엔드포인트 (v0.15.0, T-115a)
# v0.16.0 (T-117): 크롤러 제어/모니터링 엔드포인트 추가 (config/run/logs)
# 읽기 전용 + 크롤러 제어. 로컬/운영 스키마 공통(SQLAlchemy 모델) 기준 집계만 수행.
# PLATFORM: server
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.datetimeutil import KST, kst_date
from app.models import (
    Alert,
    CrawlerConfig,
    CrawlerRun,
    Device,
    PriceDailyStat,
    PricePoint,
    Product,
    ProductRelation,
    Watch,
)

router = APIRouter()

DROP_RATIO = 0.95  # ≥5% 하락 감지 기준 (insight에서 사용)

# 크롤러 주기 허용값 (초) — 1/3/6/12/24시간만 허용 (T-117)
CRAWLER_INTERVAL_CHOICES = (3600, 10800, 21600, 43200, 86400)


def _kst_date(dt: datetime) -> str:
    """UTC datetime → KST 날짜(YYYY-MM-DD) ISO 문자열."""
    return dt.astimezone(KST).date().isoformat()


@router.get("/admin/overview")
def admin_overview(db: Session = Depends(get_db)) -> dict:
    """전체 개요 — 상품/기기/찜/가격포인트/일별통계/알림/관계 수 + 품절·가격책정 상품."""
    counts = {
        "products": db.scalar(select(func.count(Product.id))) or 0,
        "devices": db.scalar(select(func.count(Device.id))) or 0,
        "watches": db.scalar(select(func.count(Watch.id))) or 0,
        "price_points": db.scalar(select(func.count(PricePoint.id))) or 0,
        "daily_stats": db.scalar(select(func.count(PriceDailyStat.id))) or 0,
        "alerts": db.scalar(select(func.count(Alert.id))) or 0,
        "relations": db.scalar(select(func.count(ProductRelation.id))) or 0,
        "priced": db.scalar(select(func.count(Product.id)).where(Product.last_price.is_not(None))) or 0,
        "sold_out": db.scalar(select(func.count(Product.id)).where(Product.sold_out_at.is_not(None))) or 0,
    }
    return counts


@router.get("/admin/trend")
def admin_trend(days: int = 30, db: Session = Depends(get_db)) -> dict:
    """일별 시리즈 — captures(수집=price_daily_stats.point_count) + points(가격 변동 price_points)
    + new_products(신규 상품 created_at). 날짜 경계는 KST 기준."""
    days = max(1, min(int(days), 180))
    today = kst_date()
    start = today - timedelta(days=days - 1)
    # KST 자정 시작 → DB 저장 규약(UTC aware)으로 변환해 비교
    tmp_start = datetime.combine(start, datetime.min.time(), KST).astimezone(timezone.utc)

    series: dict[str, dict] = {}
    # ① 일별 수집량 (price_daily_stats)
    for r in db.execute(
        select(PriceDailyStat.stat_date, func.sum(PriceDailyStat.point_count))
        .where(PriceDailyStat.stat_date >= start)
        .group_by(PriceDailyStat.stat_date)
    ):
        d = str(r[0])
        series.setdefault(d, {"captures": 0, "points": 0, "new": 0})
        series[d]["captures"] = r[1]
    # ② 가격 변동 포인트 (price_points, KST 날짜 기준)
    for r in db.execute(
        select(PricePoint.captured_at)
        .where(PricePoint.captured_at >= tmp_start)
    ):
        d = _kst_date(r[0])
        series.setdefault(d, {"captures": 0, "points": 0, "new": 0})
        series[d]["points"] += 1
    # ③ 신규 상품 (created_at, UTC 저장) — date() 변환 후 KST 날짜로 보정이 복잡하므로,
    #  UTC 날짜를 KST 날짜로 변환해 시리즈에 합산
    for r in db.execute(
        select(func.date(Product.created_at), func.count(Product.id))
        .where(Product.created_at >= tmp_start)
        .group_by(func.date(Product.created_at))
    ):
        utc_date = datetime.strptime(str(r[0]), "%Y-%m-%d").replace(tzinfo=timezone.utc)
        d = _kst_date(utc_date)
        series.setdefault(d, {"captures": 0, "points": 0, "new": 0})
        series[d]["new"] += r[1]

    days_list = []
    for i in range(days):
        d = (start + timedelta(days=i)).isoformat()
        s = series.get(d, {"captures": 0, "points": 0, "new": 0})
        days_list.append({"date": d, **s})
    return {"days": days_list}


@router.get("/admin/malls")
def admin_malls(db: Session = Depends(get_db)) -> dict:
    """몰별 집계 — 상품 수·평균 최근가·찜 수·유효가평 상품 수(=가격 이력 존재)"""
    malls = ["coupang", "naver", "oliveyoung"]
    rows = []
    for mall in malls:
        total = db.scalar(select(func.count(Product.id)).where(Product.mall == mall)) or 0
        avg = db.scalar(
            select(func.avg(Product.last_price)).where(
                Product.mall == mall, Product.last_price.is_not(None)
            )
        )
        watchers = db.scalar(
            select(func.count(Watch.id)).join(Product, Watch.product_id == Product.id)
            .where(Product.mall == mall)
        ) or 0
        priced = db.scalar(
            select(func.count(Product.id)).where(
                Product.mall == mall, Product.last_price.is_not(None)
            )
        ) or 0
        rows.append({
            "mall": mall,
            "products": total,
            "avg_price": round(avg) if avg else None,
            "watchers": watchers,
            "priced": priced,
        })
    return {"malls": rows}


@router.get("/admin/collect")
def admin_collect(db: Session = Depends(get_db)) -> dict:
    """수집 통계 — 소스별 가격이력 건수(전체) + 최근 수집 시각 (KST)."""
    src_rows = db.execute(
        select(PricePoint.source, func.count(PricePoint.id)).group_by(PricePoint.source)
    ).all()
    sources = [{"source": r[0], "count": r[1]} for r in src_rows]
    last = db.execute(select(func.max(PricePoint.captured_at))).scalar()
    return {
        "sources": sources,
        "total": sum(s["count"] for s in sources),
        "last_capture_at": _kst_date(last) + "T" + last.astimezone(KST).strftime("%H:%M") if last else None,
    }


@router.get("/admin/insight")
def admin_insight(days: int = 30, db: Session = Depends(get_db)) -> dict:
    """인사이트 — 최근 알림 타입 분포 + 최근 알림 목록 + 최근 하락 TOP(5%+)."""
    days = max(1, min(int(days), 180))
    since = datetime.now(timezone.utc) - timedelta(days=days)

    dist_rows = db.execute(
        select(Alert.alert_type, func.count(Alert.id))
        .where(Alert.created_at >= since).group_by(Alert.alert_type)
    ).all()
    alert_distribution = [{"type": t, "count": c} for t, c in dist_rows]

    recent = db.execute(
        select(Alert).where(Alert.created_at >= since).order_by(Alert.created_at.desc()).limit(20)
    ).scalars().all()
    recent_alerts = [
        {
            "product_id": a.product_id,
            "alert_type": a.alert_type,
            "price": a.price,
            "previous_price": a.previous_price,
            "created_at": a.created_at.astimezone(KST).isoformat(),
        }
        for a in recent
    ]

    # 가격 하락 TOP — 마지막 포인트 대 직전 max 가격 비교 (5%+ 하락만)
    # N+1 방지: 포인트를 단일 조회로 가져와 메모리에서 상품별 최신/직전최대 계산
    rows = db.execute(
        select(PricePoint.product_id, PricePoint.price, PricePoint.captured_at)
        .order_by(PricePoint.captured_at.desc())
    ).all()

    # 상품별 가격 시리즈 (이미 최신 순 정렬 → list[0]이 마지막 포인트)
    by_product: dict[int, list[int]] = {}
    for pid, price, _cap in rows:
        by_product.setdefault(pid, []).append(price)

    drops = []
    for pid, prices in by_product.items():
        last_price = prices[0]
        prev = max(prices[1:]) if len(prices) > 1 else None
        if prev is not None and last_price < prev and last_price / prev <= DROP_RATIO:
            drops.append({
                "product_id": pid,
                "price": last_price,
                "previous": prev,
                "drop_pct": round((1 - last_price / prev) * 100, 1),
            })
    drops.sort(key=lambda x: x["drop_pct"], reverse=True)

    return {
        "alert_distribution": alert_distribution,
        "recent_alerts": recent_alerts,
        "top_drops": drops[:20],
    }


# ── 크롤러 제어/모니터링 (v0.16.0, T-117) ──────────────────────────────────────


class CrawlerConfigIn(BaseModel):
    interval_seconds: int | None = None
    enabled: bool | None = None


def _crawler_config(db: Session) -> CrawlerConfig:
    cfg = db.get(CrawlerConfig, 1)
    if cfg is None:
        cfg = CrawlerConfig(id=1)
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


def _config_out(db: Session) -> dict:
    cfg = _crawler_config(db)
    last = db.execute(select(func.max(CrawlerRun.run_at))).scalar()
    last_run_at = None
    if last:
        last_run_at = last.astimezone(KST).isoformat()
    return {
        "interval_seconds": cfg.interval_seconds,
        "enabled": cfg.enabled,
        "run_requested": cfg.run_requested,
        "last_run_at": last_run_at,
    }


@router.get("/admin/crawler/config")
def crawler_config_get(db: Session = Depends(get_db)) -> dict:
    """크롤러 설정 조회 — 주기/활성화/트리거 대기/최근 실행 시각."""
    return _config_out(db)


@router.put("/admin/crawler/config")
def crawler_config_put(payload: CrawlerConfigIn, db: Session = Depends(get_db)) -> dict:
    """크롤러 설정 변경 — 주기(1/3/6/12/24시간) + 활성화. worker가 다음 틱(30초)에 반영."""
    cfg = _crawler_config(db)
    if payload.interval_seconds is not None:
        if payload.interval_seconds not in CRAWLER_INTERVAL_CHOICES:
            raise HTTPException(
                status_code=422,
                detail=f"interval_seconds는 {CRAWLER_INTERVAL_CHOICES} 중 하나여야 합니다.",
            )
        cfg.interval_seconds = payload.interval_seconds
    if payload.enabled is not None:
        cfg.enabled = payload.enabled
    db.commit()
    db.refresh(cfg)
    return _config_out(db)


@router.post("/admin/crawler/run")
def crawler_run_request(db: Session = Depends(get_db)) -> dict:
    """즉시 수집 요청 — run_requested=1로 설정. worker가 다음 틱(30초) 내 1배치 소비."""
    cfg = _crawler_config(db)
    cfg.run_requested = True
    db.commit()
    return {"status": "requested", "interval_seconds": cfg.interval_seconds}


@router.get("/admin/crawler/logs")
def crawler_logs(limit: int = 50, db: Session = Depends(get_db)) -> dict:
    """크롤러 배치 실행 이력 — 시각(몰별)·성공/실패·건수·소요·트리거 (KST)."""
    limit = max(1, min(int(limit), 200))
    rows = db.execute(
        select(CrawlerRun).order_by(CrawlerRun.run_at.desc(), CrawlerRun.id.desc()).limit(limit)
    ).scalars().all()
    logs = [
        {
            "mall": r.mall,
            "success": r.success,
            "count": r.count,
            "duration_ms": r.duration_ms,
            "trigger": r.trigger,
            "run_at": r.run_at.astimezone(KST).isoformat(),
        }
        for r in rows
    ]
    return {"logs": logs}