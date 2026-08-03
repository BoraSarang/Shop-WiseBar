# 추천 라우터 — 최근 가격 하락 상품 (T-58)
# 하락폭 = 최근 7일 이내 직전 포인트 대비 최신 포인트 차이, 큰 순 정렬
# 데이터 소량 가정 (N+1 허용) — 스케일 시 윈도우 함수로 전환
# PLATFORM: server
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import PricePoint, Product
from app.schemas import RecommendationOut

router = APIRouter(tags=["recommendations"])


@router.get("/recommendations", response_model=list[RecommendationOut])
def get_recommendations(limit: int = 10, days: int = 7, db: Session = Depends(get_db)) -> list[RecommendationOut]:
    """최근 days일 이내 가격이 하락한 상품 — 하락폭 큰 순 (베스트/최신 할인용)"""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    results: list[tuple[int, int, int, Product]] = []
    for product in db.scalars(select(Product)).all():
        if product.last_price is None:
            continue
        points = db.scalars(
            select(PricePoint)
            .where(PricePoint.product_id == product.id, PricePoint.captured_at >= cutoff)
            .order_by(PricePoint.captured_at.desc())
            .limit(2)
        ).all()
        if len(points) < 2:
            continue
        latest, previous = points[0], points[1]
        if latest.price < previous.price:
            results.append((previous.price - latest.price, latest.price, previous.price, product))

    results.sort(key=lambda item: item[0] / item[2], reverse=True)  # v0.7.2 — 할인율% 큰 순
    return [
        RecommendationOut(
            product_id=product.id,
            mall=product.mall,
            url=product.url,
            name=product.name,
            image=product.image,
            last_price=latest_price,
            last_checked_at=product.last_checked_at,
            drop_amount=drop,
            previous_price=previous_price,
            drop_percent=round(drop / previous_price * 100, 1) if previous_price else 0.0,
        )
        for drop, latest_price, previous_price, product in results[:limit]
    ]
