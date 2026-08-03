# 추천 라우터 — 최근 가격 하락 상품 (T-58, v0.7.2 할인율% 정렬)
# 하락폭 = 기간 내 최신 포인트 vs 직전 포인트 차이
# v0.7.3: N+1 제거 — 윈도우 함수(ROW_NUMBER + LAG) 단일 쿼리로 전환 (Neon 원격 왕복 59초 → 목표 <1초)
# v0.8.7: 노이즈 필터 — drop 5% 미만(0.1%/0.0% 등 소폭 변동) 핫딜 제외
# PLATFORM: server
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db, is_sqlite

router = APIRouter(tags=["recommendations"])

# 복합 인덱스 — 기존 테이블엔 create_all이 못 만들므로 시작 시 IF NOT EXISTS로 생성 (main.py on_startup)
INDEX_SQLS = [
    "CREATE INDEX IF NOT EXISTS ix_price_points_prod_cap ON price_points (product_id, captured_at)",
]


@router.get("/recommendations", response_model=list)
def get_recommendations(limit: int = 10, days: int = 7, db: Session = Depends(get_db)) -> list[dict]:
    """최근 days일 이내 가격이 하락한 상품 — 할인율% 큰 순 (베스트/최신 할인용)"""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    if is_sqlite:
        cutoff = cutoff.replace(tzinfo=None)  # SQLite는 naive 저장

    rows = db.execute(
        text(
            """
            WITH deduped AS (
              -- v0.8.19: 연속 동일 가격 그룹 압축 — 같은 가격이 1초만 다르면 중복 저장되는데
              -- (동시 캡처 race, 초 단위 UNIQUE), 직전 포인트가 같은 가격이면 하락률 0%로
              -- 계산되어 실질 하락(20,530→9,880 52%)이 핫딜에서 누락되는 문제
              SELECT product_id, variant, price, captured_at
              FROM (
                SELECT product_id, variant, price, captured_at,
                       LAG(price) OVER (PARTITION BY product_id, COALESCE(variant, '')
                                        ORDER BY captured_at DESC) AS lp
                FROM price_points
                WHERE captured_at >= :cutoff
              ) t
              WHERE t.lp IS DISTINCT FROM t.price
            ),
            ranked AS (
              -- v0.8.19: variant(쿠팡 수량 묶음/딜)별 분리 — variant A의 하락을
              -- variant B 가격과 비교해 오탐/누락이 나지 않도록 PARTITION을 variant 포함
              SELECT product_id, price,
                     ROW_NUMBER() OVER (PARTITION BY product_id, COALESCE(variant, '')
                                        ORDER BY captured_at DESC) AS rn,
                     LEAD(price) OVER (PARTITION BY product_id, COALESCE(variant, '')
                                       ORDER BY captured_at DESC) AS prev_price
              FROM deduped
            )
            SELECT p.id, p.mall, p.url, p.name, p.image, p.last_checked_at,
                   r.price AS latest_price, r.prev_price
            FROM ranked r
            JOIN products p ON p.id = r.product_id
            WHERE r.rn = 1 AND r.prev_price IS NOT NULL AND r.price < r.prev_price
              AND (r.prev_price - r.price) * 100.0 / r.prev_price >= :min_drop
            ORDER BY (r.prev_price - r.price) * 100.0 / r.prev_price DESC
            LIMIT :limit
            """
        ),
        {"cutoff": cutoff, "limit": limit, "min_drop": 5.0},
    ).mappings().all()

    return [
        {
            "product_id": row["id"],
            "mall": row["mall"],
            "url": row["url"],
            "name": row["name"],
            "image": row["image"],
            "last_price": row["latest_price"],
            "last_checked_at": row["last_checked_at"],
            "is_watched": False,
            "min_price": None,
            "avg_price": None,
            "price_count": 0,
            "watch_count": 0,
            "drop_amount": row["prev_price"] - row["latest_price"],
            "previous_price": row["prev_price"],
            "drop_percent": round((row["prev_price"] - row["latest_price"]) * 100.0 / row["prev_price"], 1),
        }
        for row in rows
    ]
