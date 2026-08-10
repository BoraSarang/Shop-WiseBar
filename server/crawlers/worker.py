# 크롤러 워커 (v0.16.5) — 올리브영·네이버 상품 자동 수집 (Playwright)
# 실행: `python -m crawlers.worker` (uvicorn과 별도 프로세스 — 운영은 Render Start Command 통합)
# 동작:
#   - 30초 틱으로 매 루프 DB에서 크롤러 설정을 읽어 **주기를 실시간 반영**
#   - run_requested=1 (POST /admin/crawler/run)이면 즉시 배치 실행 → 플래그 리셋
#   - enabled + 마지막 배치 후 경과 ≥ interval_seconds 면 예약 배치 (주기 기본 1시간)
#   - 배치 = oliveyoung + naver run_once 각각 호출, 결과를 crawler_runs 에 기록
#   - 배치 완료 후 브라우저 리소스 해제 (v0.16.5 — 운영 OOM 512MB 대응)
#   - `--once` 인자: 1배치만 수행 후 종료 (로컬/CI 검증용)
# PLATFORM: server
import argparse
import logging
import time
from datetime import datetime, timezone

from app.database import SessionLocal
from app.models import CrawlerConfig, CrawlerRun
from crawlers._browser import close_browser
from crawlers.naver import run_once as naver_run_once
from crawlers.oliveyoung import run_once as oliveyoung_run_once

logging.basicConfig(level=logging.INFO, format="%(asctime)s [CRAWLER] %(message)s")
logger = logging.getLogger("crawler")

# 서버 Playwright로 크롤 가능한 몰 (2차 검증 실측: oliveyoung/naver 성공, coupang Akamai 차단)
CRAWLABLE_MALLS = ("oliveyoung", "naver")

# 몰별 배치 러너 + 로그 라벨
_RUNNERS = (
    ("oliveyoung", oliveyoung_run_once),
    ("naver", naver_run_once),
)

# 설정 변경/트리거 응답 속도 (초) — render_requested 는 이 주기 이내에 소비됨
TICK_SECONDS = 30


def _get_config(db) -> CrawlerConfig:
    cfg = db.get(CrawlerConfig, 1)
    if cfg is None:  # 시드 실패 시 기본값 fallback
        cfg = CrawlerConfig(id=1)
        db.add(cfg)
        db.commit()
    return cfg


def _run_batch(db, trigger: str) -> None:
    """전체 몰 배치 실행 + 몰별 결과를 crawler_runs 에 기록.

    배치 완료 후 close_browser() — 512MB OOM 방지 (v0.16.5), 다음 배치 시 재생성된다.
    """
    for mall, runner in _RUNNERS:
        started = time.monotonic()
        try:
            # v0.16.2 (T-119) — run_once 는 (attempted, success) 반환
            # v0.16.8 (T-121) — 4튜플 (attempted, success, gone, error) — 실패 사유 기록
            attempted, count, gone, error = runner()
            duration_ms = int((time.monotonic() - started) * 1000)
            db.add(CrawlerRun(mall=mall, success=True, count=count, attempted=attempted,
                              gone=gone, error=error, duration_ms=duration_ms, trigger=trigger))
            db.commit()
            logger.info("배치 %s: %d건 수집 / %d건 시도 / %s (%.1fs)",
                        mall, count, attempted,
                        f"소멸 {gone}건" if gone else "오류 " + error if error else "정상",
                        duration_ms / 1000)
        except Exception as exc:  # noqa: BLE001 — 몰 1건 실패가 워커를 죽이지 않도록 개별 격리
            duration_ms = int((time.monotonic() - started) * 1000)
            db.add(CrawlerRun(mall=mall, success=False, count=0, attempted=0,
                              gone=0, error=f"배치 예외: {type(exc).__name__}",
                              duration_ms=duration_ms, trigger=trigger))
            db.commit()
            logger.exception("배치 %s 실패", mall)
        finally:
            close_browser()  # 다음 몰/틱을 위해 크로미움 리소스 해제


def _run_once_loop() -> None:
    """진입점 분기 도우미 — 메인 루프 공통 처리: 배치 실행 + 트리거 소비."""
    with SessionLocal() as db:
        cfg = _get_config(db)
        _run_batch(db, trigger="manual" if cfg.run_requested else "schedule")
        if cfg.run_requested:
            cfg.run_requested = False
            db.commit()
            logger.info("run_requested 소비 (즉시 배치 완료)")


def main() -> None:
    parser = argparse.ArgumentParser(description="크롤러 워커")
    parser.add_argument("--once", action="store_true", help="1배치만 실행 후 종료 (검증용)")
    args = parser.parse_args()

    if args.once:
        logger.info("크롤러 --once 시작 (몰: %s)", ",".join(CRAWLABLE_MALLS))
        _run_once_loop()
        return

    logger.info("크롤러 워커 시작 (틱 %ss, 몰: %s)", TICK_SECONDS, ",".join(CRAWLABLE_MALLS))
    last_batch_run: float | None = None
    while True:
        try:
            with SessionLocal() as db:
                cfg = _get_config(db)

                if cfg.run_requested:
                    # 수동 트리거: 즉시 1배치 → 플래그 리셋 (다음 POST까지 중복 방지)
                    last_batch_run = time.time()
                    _run_batch(db, trigger="manual")
                    cfg.run_requested = False
                    db.commit()
                    logger.info("run_requested 소비 (즉시 배치 완료)")
                elif cfg.enabled and (
                    last_batch_run is None or (time.time() - last_batch_run) >= cfg.interval_seconds
                ):
                    # 예약 배치 — 주기는 cfg.interval_seconds (실시간 반영)
                    last_batch_run = time.time()
                    _run_batch(db, trigger="schedule")
                else:
                    logger.debug("다음 틱 대기 (enabled=%s interval=%ss)", cfg.enabled, cfg.interval_seconds)
        except Exception:  # noqa: BLE001 — 배치 실패가 루프를 죽이지 않도록 최상위 격리
            logger.exception("루프 오류")
        time.sleep(TICK_SECONDS)


if __name__ == "__main__":
    main()