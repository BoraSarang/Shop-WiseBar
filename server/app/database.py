# DB 연결 — SQLAlchemy 2.x (SQLite 기본, DATABASE_URL로 교체 가능)
# PLATFORM: server
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

# v0.16.4 — Neon 등에서 복사한 `postgresql://...` 는 SQLAlchemy가 기본 드라이버로
#   psycopg2를 요구하지만 requirements는 psycopg3(psycopg[binary])다.
#   `postgresql+psycopg://` 로 정규화해 psycopg3 드라이버를 사용한다 (psycopg2 미설치 충돌 방지).
database_url = settings.database_url
if database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)

is_sqlite = database_url.startswith("sqlite")
_connect_args = {"check_same_thread": False} if is_sqlite else {}
if is_sqlite:
    # 테스트/로컬 — SQLite는 자체 SingletonThreadPool 사용
    # v0.12.2 — WAL 모드 + busy_timeout(3s)로 읽기/쓰기 동시성 Lock 지연 완화.
    # WAL은 읽기가 쓰기 진행을 오래 막지 않아 다중 요청(알람 폴링+캡처 배치) 동시 부하 개선.
    # PRAGMA는 아래 event.listens_for "connect"에서 적용 (autocommit 트랜잭션 무시).
    engine = create_engine(database_url, connect_args=_connect_args)
else:
    # v0.10.4 (T-94) — PostgreSQL(Neon 등) 연결 풀. 요청마다 TCP+TLS+인증을 새로 맺는
    # 오버헤드를 제거해 [PERF] 1~3s 지연의 주요 원인 해소.
    #   pool_size: 유휴 유지 연결 수 (연속 요청 도달 시 재사용)
    #   max_overflow: 6개 1000ms 병렬 캡처 배치까지 수용 (40개 연관 카드 배치 경합 대비)
    #   pool_pre_ping: 유휴 연결 끊김(Neon 스탠바이) 감지 → 재연결 후 사용
    #   pool_recycle: 프로비저닝 서버의 소켓 타임아웃보다 짧게 주기적 갱신
    engine = create_engine(
        database_url,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
        pool_recycle=600,
        connect_args={"sslmode": "require"} if "sslmode" not in database_url else {},
    )


@event.listens_for(engine, "connect")
def _sqlite_pragmas(dbapi_connection, connection_record):  # noqa: ARG001
    """SQLite 연결 시 PRAGMA 설정 — WAL 모드 + busy_timeout 대기 시간."""
    if is_sqlite:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=3000")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
