# ShopWiseBar Server — 중앙 상품 DB + 가격 이력 API (v0.2)
# PLATFORM: server (Python FastAPI)
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import APP_VERSION, settings
from app.database import Base, engine
from app.logging_setup import setup_logging, started_at
from app.routers import devices, products, recommendations, relations, watches
from app.routers.products import _backfill_normalized_names
from app.routers.recommendations import INDEX_SQLS

app = FastAPI(
    title="ShopWiseBar API",
    version=APP_VERSION,
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

# v0.10.3 (T-91a) — 요청 로그 미들웨어 + 전역 예외 핸들러 (E-SRV-GEN-1001)
setup_logging(app)

_APP_STARTED_AT = started_at()


@app.on_event("startup")
def on_startup() -> None:
    # SQLite 기본 — PostgreSQL 전환 시 alembic 적용 (T-51)
    Base.metadata.create_all(bind=engine)
    # v0.7.3 — 기존 테이블 복합 인덱스 (핫딜 N+1 제거 쿼리용, IF NOT EXISTS)
    with engine.begin() as conn:
        for sql in INDEX_SQLS:
            conn.execute(text(sql))
    # v0.9.1 — 신규 컬럼 마이그레이션 (create_all은 기존 테이블에 컬럼을 추가하지 않음)
    _ensure_columns(engine)
    # v0.13.0 (T-106) — 기존 상품 normalized_name 백필 (1회, 신규 컬럼)
    from app.database import SessionLocal

    try:
        with SessionLocal() as s:
            updated = _backfill_normalized_names(s)
            if updated:
                s.commit()
    except Exception:  # noqa: BLE001 — 백필 실패해도 서버 기동은 계속 (재시도 가능)
        pass


def _ensure_columns(engine) -> None:
    """v0.9.1: products.sold_out_at + watches.target_price 추가 — Neon(PostgreSQL)은
    IF NOT EXISTS 네이티브, SQLite는 PRAGMA 체크 후 ALTER"""
    with engine.begin() as conn:
        if engine.dialect.name == "sqlite":
            cols = {r[1] for r in conn.execute(text("PRAGMA table_info(products)"))}
            if "sold_out_at" not in cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN sold_out_at TIMESTAMP"))
            if "normalized_name" not in cols:  # v0.13.0 (T-106) — 크로스몰 매칭용
                conn.execute(text("ALTER TABLE products ADD COLUMN normalized_name VARCHAR(512)"))
            cols = {r[1] for r in conn.execute(text("PRAGMA table_info(watches)"))}
            if "target_price" not in cols:
                conn.execute(text("ALTER TABLE watches ADD COLUMN target_price INTEGER"))
        else:
            conn.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS sold_out_at TIMESTAMPTZ"))
            conn.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS normalized_name VARCHAR(512)"))
            conn.execute(text("ALTER TABLE watches ADD COLUMN IF NOT EXISTS target_price INTEGER"))


@app.api_route("/health", methods=["GET", "HEAD"])
def health() -> dict:
    # v0.10.3 (T-91b) — DB 연결 + 시작 시각 + 적용된 인덱스 노출 (운영 모니터링용)
    db_ok = True
    db_error = None
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001
        db_ok = False
        db_error = str(exc)
    indexes = []
    try:
        with engine.connect() as conn:
            if engine.dialect.name == "postgresql":
                rows = conn.execute(
                    text("SELECT indexname FROM pg_indexes WHERE schemaname='public'")
                )
            else:
                rows = conn.execute(
                    text("SELECT name FROM sqlite_master WHERE type='index'")
                )
            indexes = [row[0] for row in rows]
    except Exception:  # noqa: BLE001
        indexes = []
    return {
        "status": "ok" if db_ok else "degraded",
        "version": app.version,
        "started_at": _APP_STARTED_AT,
        "db": {"ok": db_ok, "error": db_error},
        "indexes": indexes,
    }
