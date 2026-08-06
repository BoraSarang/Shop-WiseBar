# DB 연결 — SQLAlchemy 2.x (SQLite 기본, DATABASE_URL로 교체 가능)
# PLATFORM: server
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

is_sqlite = settings.database_url.startswith("sqlite")
_connect_args = {"check_same_thread": False} if is_sqlite else {}
if is_sqlite:
    # 테스트/로컬 — SQLite는 자체 SingletonThreadPool 사용
    engine = create_engine(settings.database_url, connect_args=_connect_args)
else:
    # v0.10.4 (T-94) — PostgreSQL(Neon 등) 연결 풀. 요청마다 TCP+TLS+인증을 새로 맺는
    # 오버헤드를 제거해 [PERF] 1~3s 지연의 주요 원인 해소.
    #   pool_size: 유휴 유지 연결 수 (연속 요청 도달 시 재사용)
    #   max_overflow: 6개 1000ms 병렬 캡처 배치까지 수용 (40개 연관 카드 배치 경합 대비)
    #   pool_pre_ping: 유휴 연결 끊김(Neon 스탠바이) 감지 → 재연결 후 사용
    #   pool_recycle: 프로비저닝 서버의 소켓 타임아웃보다 짧게 주기적 갱신
    engine = create_engine(
        settings.database_url,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
        pool_recycle=600,
        connect_args={"sslmode": "require"} if "sslmode" not in settings.database_url else {},
    )
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
