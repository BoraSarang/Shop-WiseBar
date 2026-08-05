# 구조적 로깅 — 요청 미들웨어 + 예외 핸들러 (T-91a, v0.10.3)
# PLATFORM: server
# Render 표준출력(stdout)으로 로그 수집 — Render Dashboard → Logs에서 확인
import logging
import time
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("shopwisebar")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

# 처리되지 않은 예외(500) — 사용자 노출 메시지는 error_message_ko.json의 E-SRV-GEN-1001
GENERIC_ERROR = {"code": "E-SRV-GEN-1001", "message": "서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."}


def setup_logging(app: FastAPI) -> None:
    """요청 로그 미들웨어 + 전역 예외 핸들러를 앱에 등록한다."""

    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - start) * 1000
        logger.info(
            "req method=%s path=%s status=%d elapsed_ms=%.1f",
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
        )
        return response

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled error path=%s exc=%r", request.url.path, exc)
        return JSONResponse(status_code=500, content={"detail": GENERIC_ERROR})

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        # FastAPI HTTPException은 기본 응답 유지 (라우터가 detail에 에러코드 포함)
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


def started_at() -> str:
    return datetime.now(timezone.utc).isoformat()
