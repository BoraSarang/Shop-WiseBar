# ShopWiseBar Server — 중앙 상품 DB + 가격 이력 API (v0.2)
# PLATFORM: server (Python FastAPI)
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.database import Base, engine
from app.routers import devices, products, recommendations, relations, watches
from app.routers.recommendations import INDEX_SQLS

app = FastAPI(
    title="ShopWiseBar API",
    version="0.2.0",
    description="중앙 상품 DB + 가격 이력 + 관심 상품 알림 API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(devices.router, prefix="/api/v1")
app.include_router(products.router, prefix="/api/v1")
app.include_router(watches.router, prefix="/api/v1")
app.include_router(recommendations.router, prefix="/api/v1")
app.include_router(relations.router, prefix="/api/v1")


@app.on_event("startup")
def on_startup() -> None:
    # SQLite 기본 — PostgreSQL 전환 시 alembic 적용 (T-51)
    Base.metadata.create_all(bind=engine)
    # v0.7.3 — 기존 테이블 복합 인덱스 (핫딜 N+1 제거 쿼리용, IF NOT EXISTS)
    with engine.begin() as conn:
        for sql in INDEX_SQLS:
            conn.execute(text(sql))


@app.api_route("/health", methods=["GET", "HEAD"])
def health() -> dict:
    return {"status": "ok", "version": "0.2.0"}
