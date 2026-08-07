# pytest 공용 픽스처 — 임시 SQLite DB + FastAPI TestClient
# PLATFORM: server
import tempfile
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app

# ── 임시 DB ──────────────────────────────────────────────
@pytest.fixture(scope="session")
def test_engine():
    # 실제 shopwisebar.db/빌드 DB를 건드리지 않도록 임시 파일 사용
    tmpdir = tempfile.mkdtemp(prefix="swb-test-")
    db_path = Path(tmpdir) / "test.db"
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    yield engine
    engine.dispose()


@pytest.fixture()
def db_session(test_engine):
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = TestingSession()
    yield session
    session.rollback()  # 격리: 각 테스트는 롤백으로 초기 상태(트랜잭션 내) 유지
    session.close()


@pytest.fixture(autouse=True)
def _clean_tables(test_engine):
    """테스트 간 완전 격리 — 커밋된 데이터까지 초기화. function scope."""
    yield
    from sqlalchemy import inspect, text

    # T-105 — 공개 핫딜 인메모리 캐시도 테스트 격리 (이전 테스트 결과 재사용 방지)
    from app.routers.recommendations import _DEAL_CACHE

    _DEAL_CACHE.clear()
    insp = inspect(test_engine)
    with test_engine.begin() as conn:
        # FK 제약 무시하고 전부 비움 (SQLite)
        for table in reversed(insp.get_table_names()):
            conn.execute(text(f"DELETE FROM {table}"))


@pytest.fixture()
def client(db_session, test_engine):
    def _get_db_override():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _get_db_override
    from fastapi.testclient import TestClient

    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()