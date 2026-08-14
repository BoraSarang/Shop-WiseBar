# 통계 라우터 (v0.16.19) — 매니저 "통계" 탭용 집계 엔드포인트 4종
#   collect-by-mall: 일별 수집량 몰별 분리 (price_daily_stats JOIN products.mall)
#   price-movement:  일별 가격 하락/상승/무변동 건수 (전일 close vs 당일 close)
#   top-movers:      가격 하락/상승 TOP 10 (5% 이상 변동)
#   users:           일별 신규 기기 + 활성(7d) + 찜 증가
# 날짜 경계는 KST 기준. PLATFORM: server
from datetime import datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.datetimeutil import KST, kst_date
from app.models import Device, PriceDailyStat, PricePoint, Product, Watch

router = APIRouter()

_MALLS = ("coupang", "naver", "oliveyoung")
_DROP_RATIO = 0.95  # ≤5% 하락 (top-movers)
_RISE_RATIO = 1.05  # ≥5% 상승 (top-movers)


def _clamp_days(days: int) -> int:
    return max(1, min(int(days), 180))


def _kst_date_str(dt: datetime) -> str:
    """UTC datetime → KST 날짜(YYYY-MM-DD) ISO 문자열 (admin.py와 동일 규약)."""
    return dt.astimezone(KST).date().isoformat()


def _to_utc(dt: datetime | None) -> datetime | None:
    """naive(UTC 저장) datetime을 aware UTC로 보정 — SQLite는 tz를 안 저장하므로."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


@router.get("/admin/stats/collect-by-mall")
def stats_collect_by_mall(days: int = 30, db: Session = Depends(get_db)) -> dict:
    """일별 수집량(방문)을 몰별로 분리 — price_daily_stats.point_count를 products.mall로 join 합산."""
    days = _clamp_days(days)
    today = kst_date()
    start = today - timedelta(days=days - 1)

    rows = db.execute(
        select(PriceDailyStat.stat_date, Product.mall, func.sum(PriceDailyStat.point_count))
        .join(Product, Product.id == PriceDailyStat.product_id)
        .where(PriceDailyStat.stat_date >= start)
        .group_by(PriceDailyStat.stat_date, Product.mall)
    ).all()

    series: dict[str, dict[str, int]] = {}
    for d, mall, cnt in rows:
        series.setdefault(str(d), {m: 0 for m in _MALLS})[mall] = int(cnt)

    days_list = []
    for i in range(days):
        d = (start + timedelta(days=i)).isoformat()
        days_list.append({"date": d, **series.get(d, {m: 0 for m in _MALLS})})
    return {"days": days_list}


@router.get("/admin/stats/price-movement")
def stats_price_movement(days: int = 30, db: Session = Depends(get_db)) -> dict:
    """일별 가격 하락/상승/무변동 건수 — 상품별 일별 close_price 시퀀스에서 전일 close 대비 판정.

    down: 당일 < 전일 / up: 당일 > 전일 / flat: 동일 또는 전일 없음(첫날).
    """
    days = _clamp_days(days)
    today = kst_date()
    start = today - timedelta(days=days - 1)

    rows = db.execute(
        select(PriceDailyStat.product_id, PriceDailyStat.stat_date, PriceDailyStat.close_price)
        .where(PriceDailyStat.stat_date >= start)
        .order_by(PriceDailyStat.product_id, PriceDailyStat.stat_date)
    ).all()

    # 상품별 close 시퀀스 (date → price)
    by_product: dict[str, list[tuple[str, int]]] = {}
    for pid, d, price in rows:
        by_product.setdefault(pid, []).append((str(d), int(price)))

    counts: dict[str, dict[str, int]] = {}
    for pid, seq in by_product.items():
        prev: int | None = None
        for d, price in seq:
            slot = counts.setdefault(d, {"up": 0, "down": 0, "flat": 0})
            if prev is None:
                slot["flat"] += 1
            elif price < prev:
                slot["down"] += 1
            elif price > prev:
                slot["up"] += 1
            else:
                slot["flat"] += 1
            prev = price

    days_list = []
    for i in range(days):
        d = (start + timedelta(days=i)).isoformat()
        days_list.append({"date": d, **counts.get(d, {"up": 0, "down": 0, "flat": 0})})
    return {"days": days_list}


@router.get("/admin/stats/top-movers")
def stats_top_movers(limit: int = 10, db: Session = Depends(get_db)) -> dict:
    """가격 하락/상승 TOP — 마지막 포인트 대비 직전 최대(하락)/최소(상승) 5% 이상 변동 상품.

    drops: 최신 가격 < 직전 max, 최신/직전 ≤ 0.95
    risers: 최신 가격 > 직전 min, 최신/직전 ≥ 1.05
    """
    limit = max(1, min(int(limit), 50))

    rows = db.execute(
        select(PricePoint.product_id, PricePoint.price, PricePoint.captured_at)
        .order_by(PricePoint.captured_at.desc())
    ).all()

    by_product: dict[str, list[int]] = {}
    for pid, price, _cap in rows:
        by_product.setdefault(pid, []).append(price)

    drops: list[dict] = []
    risers: list[dict] = []
    for pid, prices in by_product.items():
        if len(prices) < 2:
            continue
        last = prices[0]
        prev_max = max(prices[1:])
        prev_min = min(prices[1:])
        if last < prev_max and last / prev_max <= _DROP_RATIO:
            drops.append({
                "product_id": pid,
                "price": last,
                "previous": prev_max,
                "change_pct": round((1 - last / prev_max) * 100, 1),
            })
        if last > prev_min and last / prev_min >= _RISE_RATIO:
            risers.append({
                "product_id": pid,
                "price": last,
                "previous": prev_min,
                "change_pct": round((last / prev_min - 1) * 100, 1),
            })

    drops.sort(key=lambda x: x["change_pct"], reverse=True)
    risers.sort(key=lambda x: x["change_pct"], reverse=True)
    drops, risers = drops[:limit], risers[:limit]

    # 상품 메타 일괄 조회 (N+1 방지)
    ids = {d["product_id"] for d in drops} | {r["product_id"] for r in risers}
    prods = {}
    if ids:
        prods = {p.id: p for p in db.execute(select(Product).where(Product.id.in_(ids))).scalars()}

    def enrich(items: list[dict]) -> list[dict]:
        for it in items:
            p = prods.get(it["product_id"])
            it["name"] = p.name if p else None
            it["image"] = p.image if p else None
            it["url"] = p.url if p else None
            it["mall"] = p.mall if p else None
        return items

    return {"drops": enrich(drops), "risers": enrich(risers)}


@router.get("/admin/stats/users")
def stats_users(days: int = 30, db: Session = Depends(get_db)) -> dict:
    """사용자 증가율 — 일별 신규 기기 + 활성(해당일 포함 7일 창) + 찜 증가 + 현재 활성 합계."""
    days = _clamp_days(days)
    today = kst_date()
    start = today - timedelta(days=days - 1)
    tmp_start = datetime.combine(start, time.min, KST).astimezone(timezone.utc)

    # ① 일별 신규 기기
    new_dev: dict[str, int] = {}
    for r in db.execute(select(Device.created_at).where(Device.created_at >= tmp_start)):
        d = _kst_date_str(r[0])
        new_dev[d] = new_dev.get(d, 0) + 1

    # ② 일별 찜 증가
    new_watch: dict[str, int] = {}
    for r in db.execute(select(Watch.created_at).where(Watch.created_at >= tmp_start)):
        d = _kst_date_str(r[0])
        new_watch[d] = new_watch.get(d, 0) + 1

    # ③ 일별 활성(7d) — 해당 KST 날짜 포함 직전 7일 창에 last_seen_at이 있는 기기 수
    last_seens = [_to_utc(r[0]) for r in db.execute(select(Device.last_seen_at)) if r[0] is not None]
    active_7d: dict[str, int] = {}
    for i in range(days):
        d = start + timedelta(days=i)
        window_start = datetime.combine(d, time.min, KST).astimezone(timezone.utc) - timedelta(days=6)
        window_end = datetime.combine(d + timedelta(days=1), time.min, KST).astimezone(timezone.utc)
        active_7d[d.isoformat()] = sum(1 for ls in last_seens if window_start <= ls < window_end)

    # ④ 현재 활성 합계 (24h/7d)
    now = datetime.now(timezone.utc)
    active_24h = sum(1 for ls in last_seens if (now - ls).total_seconds() <= 24 * 3600)
    active_7d_now = sum(1 for ls in last_seens if (now - ls).total_seconds() <= 7 * 24 * 3600)

    days_list = []
    for i in range(days):
        d = (start + timedelta(days=i)).isoformat()
        days_list.append({
            "date": d,
            "new_devices": new_dev.get(d, 0),
            "active_7d": active_7d.get(d, 0),
            "new_watches": new_watch.get(d, 0),
        })

    return {
        "days": days_list,
        "totals": {
            "devices": db.scalar(select(func.count(Device.id))) or 0,
            "active_24h": active_24h,
            "active_7d": active_7d_now,
        },
    }
