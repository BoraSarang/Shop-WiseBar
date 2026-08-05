# 추천 라우터 — 최근 가격 하락 상품 (T-58, v0.7.2 할인율% 정렬)
# 하락폭 = 기간 내 최신 포인트 vs 직전 포인트 차이
# v0.7.3: N+1 제거 — 윈도우 함수(ROW_NUMBER + LAG) 단일 쿼리로 전환 (Neon 원격 왕복 59초 → 목표 <1초)
# v0.8.7: 노이즈 필터 — drop 5% 미만(0.1%/0.0% 등 소폭 변동) 핫딜 제외
# v0.8.26: 핫딜 강화 —
#   ① 하락 상품이 없어도 역대 최저가 갱신 상품으로 부족분 채움 (핫딜 탭이 항상 유의미한 결과 제공)
#   ② 같은 product_id의 variant가 여러 개여도 1건만 노출
#   ③ 응답에 reason 필드 (drop=가격 하락 / low=최저가 갱신) — 팝업 배지 표시용
# PLATFORM: server
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db, is_sqlite

router = APIRouter(tags=["recommendations"])

# 복합 인덱스 — 기존 테이블엔 create_all이 못 만들므로 시작 시 IF NOT EXISTS로 생성 (main.py on_startup)
# v0.10.1: stats/추이/추천이 price_daily_stats를 (product_id, stat_date>=) 로 조회하므로
#          복합 인덱스 추가. product_relations는 source OR target 양방향 조회용 복합 추가.
INDEX_SQLS = [
    "CREATE INDEX IF NOT EXISTS ix_price_points_prod_cap ON price_points (product_id, captured_at)",
    "CREATE INDEX IF NOT EXISTS ix_price_daily_prod_date ON price_daily_stats (product_id, stat_date)",
    "CREATE INDEX IF NOT EXISTS ix_product_relations_pair ON product_relations (source_product_id, target_product_id)",
]


@router.get("/recommendations", response_model=list)
def get_recommendations(limit: int = 10, days: int = 7, db: Session = Depends(get_db)) -> list[dict]:
    """최근 days일 이내 ①하락폭 큰 상품 → ②역대 최저가 갱신 상품 (부족분 채움)"""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    if is_sqlite:
        cutoff = cutoff.replace(tzinfo=None)  # SQLite는 naive 저장

    # 1) 하락 상품 — 기간 내 캡처 중 하락폭(직전 대비) 5% 이상, variant 중복은 1건만
    rows = db.execute(
        text(
            """
            WITH deduped AS (
              -- (상품, variant, 가격) 그룹별 최신 1건만 유지 — 같은 가격 초 단위 중복 방지
              -- v0.8.20: 쿠팡은 variant(수량 묶음/딜) 미지정 포인트가 서로 다른 옵션
              -- 가격을 섞어 하락 오탐을 만듦 → 쿠팡은 variant 지정 포인트만 신뢰
              SELECT pp.product_id, pp.variant, pp.price, pp.captured_at, p.mall
              FROM (
                SELECT product_id, variant, price, captured_at,
                       ROW_NUMBER() OVER (PARTITION BY product_id, COALESCE(variant, ''), price
                                          ORDER BY captured_at DESC) AS rn2
                FROM price_points
                WHERE captured_at >= :cutoff
              ) pp
              JOIN products p ON p.id = pp.product_id
              WHERE pp.rn2 = 1
                AND (p.mall <> 'coupang' OR pp.variant IS NOT NULL)
            ),
            ranked AS (
              -- variant별 최신 1건 + 직전 가격(LEAD) — variant A의 하락을 B와 비교하지 않도록 PARTITION
              SELECT product_id, variant, price, mall,
                     ROW_NUMBER() OVER (PARTITION BY product_id, COALESCE(variant, '')
                                        ORDER BY captured_at DESC) AS rn,
                     LEAD(price) OVER (PARTITION BY product_id, COALESCE(variant, '')
                                       ORDER BY captured_at DESC) AS prev_price
              FROM deduped
            ),
            per_product AS (
              -- 같은 product_id의 variant 중 drop% 가장 큰 1건만
              SELECT product_id, variant, mall,
                     price AS latest_price, prev_price,
                     ROW_NUMBER() OVER (PARTITION BY product_id
                                        ORDER BY (prev_price - price) * 100.0 / prev_price DESC) AS prn
              FROM ranked
              WHERE rn = 1 AND prev_price IS NOT NULL AND price < prev_price
                AND (prev_price - price) * 100.0 / prev_price >= :min_drop
            )
            SELECT p.id, p.mall, p.url, p.name, p.image, p.last_checked_at,
                   t.latest_price, t.prev_price
            FROM per_product t
            JOIN products p ON p.id = t.product_id
            WHERE t.prn = 1
            ORDER BY (t.prev_price - t.latest_price) * 100.0 / t.prev_price DESC
            LIMIT :limit
            """
        ),
        {"cutoff": cutoff, "limit": limit, "min_drop": 5.0},
    ).mappings().all()
    filled = [dict(r) for r in rows]

    # 2) 최저가 갱신 상품 — 하락 상품으로 limit를 못 채운 경우 (v0.8.26)
    if len(filled) < limit:
        low_rows = db.execute(
            text(
                """
                WITH deduped AS (
                  SELECT pp.product_id, pp.variant, pp.price, p.mall
                  FROM (
                    SELECT product_id, variant, price,
                           ROW_NUMBER() OVER (PARTITION BY product_id, COALESCE(variant, ''), price
                                              ORDER BY captured_at DESC) AS rn2
                    FROM price_points
                    WHERE captured_at >= :cutoff
                  ) pp
                  JOIN products p ON p.id = pp.product_id
                  WHERE pp.rn2 = 1
                    AND (p.mall <> 'coupang' OR pp.variant IS NOT NULL)
                ),
                cur AS (
                  -- 기간 내 상품별 최저가
                  SELECT product_id, mall, MIN(price) AS cur_low
                  FROM deduped
                  GROUP BY product_id, mall
                ),
                hist AS (
                  -- 기간 시작 이전의 역대 최저가 (기간 전 기록이 있는 상품만)
                  SELECT pp.product_id, MIN(pp.price) AS before_low
                  FROM price_points pp
                  WHERE pp.captured_at < :cutoff
                  GROUP BY pp.product_id
                )
                SELECT p.id, p.mall, p.url, p.name, p.image, p.last_checked_at,
                       c.cur_low, h.before_low
                FROM cur c
                JOIN products p ON p.id = c.product_id
                JOIN hist h ON h.product_id = c.product_id
                WHERE c.cur_low <= h.before_low
                ORDER BY (h.before_low - c.cur_low) DESC, c.cur_low ASC
                LIMIT :limit
                """
            ),
            {"cutoff": cutoff, "limit": limit},
        ).mappings().all()
        filled_ids = {r["id"] for r in filled}
        for row in low_rows:
            if len(filled) >= limit:
                break
            if row["id"] in filled_ids:
                continue
            filled.append(
                {
                    "id": row["id"],
                    "mall": row["mall"],
                    "url": row["url"],
                    "name": row["name"],
                    "image": row["image"],
                    "last_checked_at": row["last_checked_at"],
                    "latest_price": row["cur_low"],
                    "prev_price": None,  # 최저가 갱신 — 직전가 비교 없음
                    "_reason": "low",
                }
            )

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
            "drop_amount": (row["prev_price"] - row["latest_price"]) if row.get("prev_price") is not None else 0,
            "previous_price": row.get("prev_price"),
            "drop_percent": round((row["prev_price"] - row["latest_price"]) * 100.0 / row["prev_price"], 1)
            if row.get("prev_price") is not None
            else 0,
            "reason": row.get("_reason") or "drop",
        }
        for row in filled
    ]
