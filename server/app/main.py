# ShopWiseBar Server — 중앙 상품 DB + 가격 이력 API (v0.2)
# PLATFORM: server (Python FastAPI)
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.routers import devices, products, recommendations, watches

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


@app.on_event("startup")
def on_startup() -> None:
    # SQLite 기본 — PostgreSQL 전환 시 alembic 적용 (T-51)
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "version": "0.2.0"}
