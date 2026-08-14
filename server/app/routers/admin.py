# 관리자(Admin) 조회 라우터 — macOS ShopWiseBarManager 앱용 집계 엔드포인트 (v0.15.0, T-115a)
# v0.16.0 (T-117): 크롤러 제어/모니터링 엔드포인트 추가 (config/run/logs)
# v0.16.15 (T-126): P0 관리 고도화 — /admin/health, /admin/crawler/summary, /admin/products/top, /admin/products/{id}
# 읽기 전용 + 크롤러 제어. 로컬/운영 스키마 공통(SQLAlchemy 모델) 기준 집계만 수행.
# PLATFORM: server
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from crawlers.oliveyoung import fetch_goods_diag
from app.config import APP_VERSION
from app.database import get_db
from app.datetimeutil import KST, kst_date
from app.models import (
    Alert,
    CrawlTarget,
    CrawlerConfig,
    CrawlerRun,
    Device,
    PriceDailyStat,
    PricePoint,
    Product,
    ProductRelation,
    Watch,
)
from app.routers.products import _match_alternatives

# v0.16.15 (T-126) — 서버 시작 시각 (프로세스 기준, UTC)
_SERVER_STARTED_AT = datetime.now(timezone.utc).isoformat()

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
    # v0.16.16 (T-127) — 동일 상품은 최신 알림 1건만 노출 (같은 상품 반복 알림 중복 제거)
    seen: set[str] = set()
    recent = [a for a in recent if not (a.product_id in seen or seen.add(a.product_id))]
    # v0.16.16 (T-127) — 상품 메타 조인: 알림 product_id → 상품명/이미지/URL/몰 (N+1 방지 단일 조회)
    alert_products = {
        p.id: p for p in db.execute(
            select(Product).where(Product.id.in_({a.product_id for a in recent}))
        ).scalars().all()
    }
    recent_alerts = [
        {
            "product_id": a.product_id,
            "alert_type": a.alert_type,
            "price": a.price,
            "previous_price": a.previous_price,
            "created_at": a.created_at.astimezone(KST).isoformat(),
            "name": (alert_products.get(a.product_id).name if alert_products.get(a.product_id) else None),
            "image": (alert_products.get(a.product_id).image if alert_products.get(a.product_id) else None),
            "url": (alert_products.get(a.product_id).url if alert_products.get(a.product_id) else None),
            "mall": (alert_products.get(a.product_id).mall if alert_products.get(a.product_id) else None),
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
    drops = drops[:20]
    # v0.16.16 (T-127) — 하락 TOP 상품 메타 조인
    drop_products = {
        p.id: p for p in db.execute(
            select(Product).where(Product.id.in_({d["product_id"] for d in drops}))
        ).scalars().all()
    }
    for d in drops:
        p = drop_products.get(d["product_id"])
        d["name"] = p.name if p else None
        d["image"] = p.image if p else None
        d["url"] = p.url if p else None
        d["mall"] = p.mall if p else None

    return {
        "alert_distribution": alert_distribution,
        "recent_alerts": recent_alerts,
        "top_drops": drops,
    }


# ── P0 관리 고도화 (v0.16.15, T-126) ─────────────────────────────────────────


@router.get("/admin/health")
def admin_health(db: Session = Depends(get_db)) -> dict:
    """서버 온라인 상태 — 버전·시작 시각·DB 연결·최근 수집/크롤러 시각 (KST)."""
    db_ok = True
    db_error = None
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001
        db_ok = False
        db_error = str(exc)
    last_capture = db.execute(select(func.max(PricePoint.captured_at))).scalar()
    last_run = db.execute(select(func.max(CrawlerRun.run_at))).scalar()
    return {
        "status": "ok" if db_ok else "degraded",
        "version": APP_VERSION,
        "started_at": _SERVER_STARTED_AT,
        "db": {"ok": db_ok, "error": db_error},
        "last_capture_at": last_capture.astimezone(KST).isoformat() if last_capture else None,
        "last_crawler_run_at": last_run.astimezone(KST).isoformat() if last_run else None,
    }


@router.get("/admin/crawler/summary")
def crawler_summary(hours: int = 24, db: Session = Depends(get_db)) -> dict:
    """크롤러 요약 — 최근 N시간 배치 성공률·실패·상품없음·평균 소요 + 최근 실행 + 스테일 상품 수."""
    hours = max(1, min(int(hours), 168))
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    runs = db.execute(
        select(CrawlerRun).where(CrawlerRun.run_at >= since).order_by(CrawlerRun.run_at.desc())
    ).scalars().all()
    last_24h = {
        "runs": len(runs),
        "success": sum(1 for r in runs if r.success),
        "failed": sum(1 for r in runs if not r.success),
        "gone": sum(r.gone for r in runs),
        "count": sum(r.count for r in runs),
        "avg_duration_ms": round(sum(r.duration_ms for r in runs) / len(runs)) if runs else 0,
    }
    last_runs = [
        {
            "mall": r.mall,
            "success": r.success,
            "count": r.count,
            "gone": r.gone,
            "error": r.error,
            "duration_ms": r.duration_ms,
            "trigger": r.trigger,
            "run_at": r.run_at.astimezone(KST).isoformat(),
        }
        for r in runs[:20]
    ]
    # 스테일 상품 수 — 배치 후보 = last_checked_at NULL 또는 N분 경과 (worker run_once 기준)
    now = datetime.now(timezone.utc)
    stale_after = 60 * 60
    cand = db.execute(select(Product).where(Product.mall.in_(["oliveyoung", "naver"]))).scalars().all()
    stale = sum(1 for p in cand if p.last_checked_at is None or (now - p.last_checked_at).total_seconds() > stale_after)
    return {"hours": hours, "last_24h": last_24h, "last_runs": last_runs, "stale_products": stale}


@router.get("/admin/products/top")
def admin_products_top(limit: int = 20, db: Session = Depends(get_db)) -> dict:
    """수집 상품 인사이트 — 많이 수집된 상품(가격포인트+찜 TOP) + 최근 수집 + 품절/복귀.

    - most_collected: price_points 건수 내림차순 (동률 시 찜 수 보조)
    - recent: last_checked_at 최신순
    - sold_out: 품절 중 최신순
    - restocked: 품절→복귀 최신순
    """
    limit = max(1, min(int(limit), 100))

    # 가격포인트 건수
    pc = dict(db.execute(
        select(PricePoint.product_id, func.count(PricePoint.id))
        .group_by(PricePoint.product_id)
    ).all())
    # 찜 수
    wc = dict(db.execute(
        select(Watch.product_id, func.count(Watch.id)).group_by(Watch.product_id)
    ).all())

    def item_rows(ids: list[str]) -> list[dict]:
        if not ids:
            return []
        prods = {p.id: p for p in db.execute(select(Product).where(Product.id.in_(ids))).scalars()}
        out = []
        for pid in ids:
            p = prods.get(pid)
            if p is None:
                continue
            out.append({
                "product_id": pid,
                "mall": p.mall,
                "name": p.name,
                "url": p.url,
                "image": p.image,
                "last_price": p.last_price,
                "sold_out_at": p.sold_out_at.astimezone(KST).isoformat() if p.sold_out_at else None,
                "back_on_sale_at": p.back_on_sale_at.astimezone(KST).isoformat() if p.back_on_sale_at else None,
                "last_checked_at": p.last_checked_at.astimezone(KST).isoformat() if p.last_checked_at else None,
                "price_count": pc.get(pid, 0),
                "watch_count": wc.get(pid, 0),
            })
        return out

    # ① 많이 수집된 상품 — 가격포인트 내림차순, 동률 시 찜 수
    most = sorted(pc.keys(), key=lambda pid: (pc[pid], wc.get(pid, 0)), reverse=True)[:limit]
    # ② 최근 수집
    recent = [
        r[0] for r in db.execute(
            select(Product.id).where(Product.last_checked_at.is_not(None))
            .order_by(Product.last_checked_at.desc()).limit(limit)
        ).all()
    ]
    # ③ 품절 중
    sold_out = [
        r[0] for r in db.execute(
            select(Product.id).where(Product.sold_out_at.is_not(None))
            .order_by(Product.sold_out_at.desc()).limit(limit)
        ).all()
    ]
    # ④ 품절→복귀
    restocked = [
        r[0] for r in db.execute(
            select(Product.id).where(Product.back_on_sale_at.is_not(None))
            .order_by(Product.back_on_sale_at.desc()).limit(limit)
        ).all()
    ]

    return {
        "most_collected": item_rows(most),
        "recent": item_rows(recent),
        "sold_out": item_rows(sold_out),
        "restocked": item_rows(restocked),
    }


@router.get("/admin/products/{product_id}")
def admin_product_detail(product_id: str, db: Session = Depends(get_db)) -> dict:
    """단일 상품 드릴다운 — 메타 + 가격 통계 + 최근 가격 이력 + 몰 간 비교."""
    p = db.get(Product, product_id)
    if p is None:
        raise HTTPException(status_code=404, detail="상품을 찾을 수 없습니다.")
    min_price = db.scalar(select(func.min(PricePoint.price)).where(PricePoint.product_id == product_id))
    avg_price = db.scalar(select(func.avg(PricePoint.price)).where(PricePoint.product_id == product_id))
    price_count = db.scalar(select(func.count(PricePoint.id)).where(PricePoint.product_id == product_id)) or 0
    watch_count = db.scalar(select(func.count(Watch.id)).where(Watch.product_id == product_id)) or 0
    prices = [
        {
            "price": r.price,
            "source": r.source,
            "captured_at": r.captured_at.astimezone(KST).isoformat(),
        }
        for r in db.execute(
            select(PricePoint).where(PricePoint.product_id == product_id)
            .order_by(PricePoint.captured_at.desc()).limit(30)
        ).scalars()
    ]
    alternatives = [
        {
            "product_id": a.id,
            "mall": a.mall,
            "name": a.name,
            "last_price": a.last_price,
            "url": a.url,
        }
        for a in _match_alternatives(db, p)
    ]
    return {
        "product_id": p.id,
        "mall": p.mall,
        "name": p.name,
        "url": p.url,
        "image": p.image,
        "normalized_name": p.normalized_name,
        "last_price": p.last_price,
        "sold_out_at": p.sold_out_at.astimezone(KST).isoformat() if p.sold_out_at else None,
        "back_on_sale_at": p.back_on_sale_at.astimezone(KST).isoformat() if p.back_on_sale_at else None,
        "created_at": p.created_at.astimezone(KST).isoformat() if p.created_at else None,
        "min_price": int(min_price) if min_price is not None else None,
        "avg_price": round(float(avg_price)) if avg_price is not None else None,
        "price_count": price_count,
        "watch_count": watch_count,
        "prices": prices,
        "alternatives": alternatives,
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
            "attempted": r.attempted,  # v0.16.2 (T-119)
            "failed": max(0, r.attempted - r.count - r.gone),  # 실패 = 시도 - 성공 - 상품없음 (v0.16.8)
            "gone": r.gone,  # v0.16.8 (T-121) — 상품 없음(소멸) 건수
            "error": r.error,  # v0.16.8 (T-121) — 실패 사유
            "duration_ms": r.duration_ms,
            "trigger": r.trigger,
            "run_at": r.run_at.astimezone(KST).isoformat(),
        }
        for r in rows
    ]
    return {"logs": logs}


@router.get("/admin/crawler/diag/products")
def crawler_diag_products(limit: int = 200, db: Session = Depends(get_db)) -> dict:
    """진단(T-122a): 운영 DB 상품 스테일 현황 — 어떤 상품이 배치 후보인지 확인.

    배치 후보 = last_checked_at NULL 또는 60분 이상 경과 (worker run_once와 동일 기준).
    gone/error 반복으로 count=0 고착 원인 파악용.
    """
    limit = max(1, min(int(limit), 500))
    rows = db.execute(
        select(Product).filter(Product.mall == "oliveyoung")
        .order_by(Product.last_checked_at.asc().nulls_first())
        .limit(limit)
    ).scalars().all()
    now = datetime.now(timezone.utc)
    stale_after = 60 * 60
    items = []
    stale_cnt = 0
    for p in rows:
        lc = p.last_checked_at
        stale = lc is None or (now - lc).total_seconds() > stale_after
        if stale:
            stale_cnt += 1
        items.append({
            "id": p.id,
            "stale": stale,
            "last_checked_at": lc.astimezone(KST).isoformat() if lc else None,
            "last_price": p.last_price,
            "name": (p.name or "")[:40],
        })
    return {"total": len(rows), "stale": stale_cnt, "items": items}


@router.get("/admin/users")
def admin_users(db: Session = Depends(get_db)) -> dict:
    """사용자 활동 (P1, v0.16.15) — 기기별 활성 상태·찜 수·수집 건수·최근 활동.

    last_seen_at이 24시간 이내면 active. device_id 컬럼(가격포인트)이 없던
    과거 데이터는 수집 건수에 집계되지 않는다 (heartbeat 시작 시점부터 누적).
    """
    now = datetime.now(timezone.utc)
    devices = db.execute(select(Device)).scalars().all()
    watch_counts = dict(db.execute(
        select(Watch.device_id, func.count(Watch.id)).group_by(Watch.device_id)
    ).all())
    capture_counts = dict(db.execute(
        select(PricePoint.device_id, func.count(PricePoint.id))
        .where(PricePoint.device_id.is_not(None))
        .group_by(PricePoint.device_id)
    ).all())
    users = []
    active = 0
    for d in devices:
        last = d.last_seen_at
        if last is not None and last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
        is_active = last is not None and (now - last).total_seconds() <= 24 * 3600
        if is_active:
            active += 1
        users.append({
            "device_id": d.id,
            "created_at": d.created_at.astimezone(KST).isoformat() if d.created_at else None,
            "last_seen_at": last.astimezone(KST).isoformat() if last else None,
            "active": is_active,
            "watches": watch_counts.get(d.id, 0),
            "captures": capture_counts.get(d.id, 0),
        })
    users.sort(key=lambda u: (u["last_seen_at"] is not None, u["last_seen_at"] or ""), reverse=True)
    return {
        "total": len(users),
        "active_24h": active,
        "users": users,
    }


@router.get("/admin/crawler/diag/fetch/{goods_no}")
def crawler_diag_fetch(goods_no: str) -> dict:
    """진단(T-122a): 단일 상품을 실제 크롤링해 렌더 결과를 상세 반환.

    운영(미국 IP)에서 상품 페이지가 어떤 식으로 렌더되는지(body 원문/og:title) 확인해
    gone/error 오판 여부를 판정한다. 브라우저를 띄우므로 응답까지 수십 초 소요.
    """
    return fetch_goods_diag(goods_no)


# ── P2 가격 동향 비교 (v0.16.15, T-126) ───────────────────────────────────────


@router.get("/admin/price-compare")
def admin_price_compare(limit: int = 30, db: Session = Depends(get_db)) -> dict:
    """가격 동향 비교 — 한 상품이 여러 몰에 존재할 때 몰 간 현재가 차이를 보여줌.

    normalized_name(동일상품)으로 묶어 2개 이상 몰에 있는 상품만 집계. 각 그룹에서
    최저가 몰 대비 다른 몰이 얼마나 비싼지(오버프라이스 %)를 계산. _match_alternatives와
    동일한 정규화명 기반 동적 매칭을 사용한다.
    """
    limit = max(1, min(int(limit), 100))
    rows = db.execute(
        select(Product)
        .where(Product.normalized_name.is_not(None), Product.last_price.is_not(None))
    ).scalars().all()

    groups: dict[str, list[Product]] = {}
    for p in rows:
        groups.setdefault(p.normalized_name, []).append(p)

    items = []
    for name, prods in groups.items():
        if len({p.mall for p in prods}) < 2:  # 몰이 2개 이상일 때만 비교 의미
            continue
        priced = [p for p in prods if p.last_price]
        if len(priced) < 2:
            continue
        cheapest = min(priced, key=lambda p: p.last_price)
        rows_out = []
        for p in sorted(priced, key=lambda p: p.last_price):
            diff = 0.0
            if p.id != cheapest.id and cheapest.last_price:
                diff = round((p.last_price - cheapest.last_price) / cheapest.last_price * 100, 1)
            rows_out.append({
                "product_id": p.id,
                "mall": p.mall,
                "name": p.name,
                "price": p.last_price,
                "url": p.url,
                "diff_pct": diff,
                "is_cheapest": p.id == cheapest.id,
            })
        items.append({
            "normalized_name": name,
            "name": (cheapest.name or name),
            "cheapest_mall": cheapest.mall,
            "cheapest_price": cheapest.last_price,
            "rows": rows_out,
        })
    items.sort(key=lambda g: g["rows"][-1]["diff_pct"], reverse=True)  # 최대 차이순
    return {"groups": items[:limit], "total_groups": len(items)}


# ── 수집 대상 페이지 (v0.16.16, T-127) ────────────────────────────────────────


class CrawlTargetIn(BaseModel):
    mall: str
    label: str
    url: str
    enabled: bool = True


_CRAWL_TARGET_MALLS = ("naver", "oliveyoung", "custom")


@router.get("/admin/crawl/targets")
def admin_crawl_targets(db: Session = Depends(get_db)) -> dict:
    """수집 대상 목록 페이지 조회 — enabled 우선 정렬."""
    rows = db.execute(select(CrawlTarget).order_by(CrawlTarget.enabled.desc(), CrawlTarget.id.asc())).scalars().all()
    return {"targets": [
        {"id": t.id, "mall": t.mall, "label": t.label, "url": t.url, "enabled": t.enabled,
         "created_at": t.created_at.astimezone(KST).isoformat()}
        for t in rows
    ]}


@router.post("/admin/crawl/targets")
def admin_crawl_targets_create(body: CrawlTargetIn, db: Session = Depends(get_db)) -> dict:
    """수집 대상 페이지 등록 — mall/url 검증, 중복 url은 409."""
    mall = body.mall.strip().lower()
    if mall not in _CRAWL_TARGET_MALLS:
        raise HTTPException(422, f"mall는 {', '.join(_CRAWL_TARGET_MALLS)} 중 하나여야 합니다.")
    url = body.url.strip()
    if not (url.startswith("http://") or url.startswith("https://")):
        raise HTTPException(422, "url은 http(s)로 시작해야 합니다.")
    label = body.label.strip()
    if not label:
        raise HTTPException(422, "label은 비어 있을 수 없습니다.")

    exists = db.execute(select(CrawlTarget).where(CrawlTarget.url == url)).scalar_one_or_none()
    if exists:
        raise HTTPException(409, "이미 등록된 수집 대상입니다.")
    target = CrawlTarget(mall=mall, label=label, url=url, enabled=body.enabled)
    db.add(target)
    db.commit()
    db.refresh(target)
    return {"targets": [
        {"id": t.id, "mall": t.mall, "label": t.label, "url": t.url, "enabled": t.enabled,
         "created_at": t.created_at.astimezone(KST).isoformat()}
        for t in db.execute(select(CrawlTarget).order_by(CrawlTarget.id.asc())).scalars().all()
    ]}


@router.delete("/admin/crawl/targets/{target_id}")
def admin_crawl_targets_delete(target_id: int, db: Session = Depends(get_db)) -> dict:
    """수집 대상 삭제 — 없으면 204 idempotent."""
    target = db.get(CrawlTarget, target_id)
    if target is not None:
        db.delete(target)
        db.commit()
    return {"status": "deleted"}