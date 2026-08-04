# 상품 연관 관계 API (Phase 3, v0.9.0)
# POST /products/relations — 상품 페이지에서 함께 노출된 연관 상품 쌍 저장 (weight += 1)
# GET  /products/{id}/related — 해당 상품과 함께 등장한 상품 목록 (양방향, weight desc)
# PLATFORM: server
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import case, func, select, update
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Product, ProductRelation

router = APIRouter()


class RelationBatchIn(BaseModel):
    source: str = Field(min_length=1, max_length=255)
    targets: list[str] = Field(min_length=1, max_length=20)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@router.post("/products/relations")
def save_relations(payload: RelationBatchIn, db: Session = Depends(get_db)) -> dict:
    """상품 페이지 방문 시 연관 카드 목록을 관계로 저장 — 기존 쌍은 weight += 1
    (관계는 부모/자식 성격이 없으므로 source-target 쌍으로만 저장, 역방향은 조회 시 OR)"""
    source = payload.source
    targets = [t for t in payload.targets if t and t != source][:10]
    if not targets:
        return {"product_id": source, "saved": 0}

    existing = {
        (r.source_product_id, r.target_product_id)
        for r in db.scalars(
            select(ProductRelation).where(
                ProductRelation.source_product_id == source,
                ProductRelation.target_product_id.in_(targets),
            )
        )
    }
    if existing:
        db.execute(
            update(ProductRelation)
            .where(ProductRelation.source_product_id == source, ProductRelation.target_product_id.in_(targets))
            .values(weight=ProductRelation.weight + 1, updated_at=_utcnow())
        )
    new_pairs = [
        ProductRelation(source_product_id=source, target_product_id=t, kind="related", weight=1)
        for t in targets
        if (source, t) not in existing
    ]
    if new_pairs:
        db.add_all(new_pairs)
    db.commit()
    return {"product_id": source, "saved": len(new_pairs), "incremented": len(existing)}


@router.get("/products/{product_id}/related")
def get_related(product_id: str, limit: int = 10, db: Session = Depends(get_db)) -> list[dict]:
    """해당 상품과 함께 노출된 상품 목록 — 무방향 그래프로 취급:
    양방향 쌍의 weight를 노드별 합산 후 내림차순 (예: A→B 2회 + B→A 1회 = 강도 3)"""
    limit = max(1, min(limit, 30))
    other = case(
        (ProductRelation.source_product_id == product_id, ProductRelation.target_product_id),
        else_=ProductRelation.source_product_id,
    )
    rows = db.execute(
        select(other.label("other_id"), func.sum(ProductRelation.weight).label("total"))
        .where(
            (ProductRelation.source_product_id == product_id) | (ProductRelation.target_product_id == product_id)
        )
        .group_by(other)
        .order_by(func.sum(ProductRelation.weight).desc(), func.max(ProductRelation.updated_at).desc())
        .limit(limit)
    ).all()
    products = {p.id: p for p in db.scalars(select(Product).where(Product.id.in_([r.other_id for r in rows])))}
    return [
        {
            "product_id": r.other_id,
            "mall": p.mall,
            "url": p.url,
            "name": p.name,
            "image": p.image,
            "last_price": p.last_price,
            "weight": r.total,
        }
        for r in rows
        if (p := products.get(r.other_id)) is not None
    ]
