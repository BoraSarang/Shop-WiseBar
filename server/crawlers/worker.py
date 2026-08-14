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

from sqlalchemy import select

from app.database import SessionLocal
from app.models import CrawlTarget, CrawlerConfig, CrawlerRun
from crawlers._browser import close_browser
from crawlers.naver import run_once as naver_run_once
from crawlers.oliveyoung import run_once as oliveyoung_run_once
from crawlers.targets import run_target_once

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


def _record_run(mall: str, trigger: str, success: bool, count: int,
                attempted: int, gone: int, error: str | None, duration_ms: int) -> None:
    """배치 결과를 crawler_runs 에 기록 — 반드시 **새 세션**으로.

    배치(수 분) 동안 바깥 세션을 들고 있으면 Render/Neon 프록시가 유휴 커넥션을
    끊어 커밋이 실패한다 (운영 실측, v0.16.9 루프 오류: crawler_runs INSERT 실패).
    → 기록은 항상 방금 연 세션에서 수행해 깨진 세션 재사용을 방지한다.
    """
    try:
        with SessionLocal() as db:
            db.add(CrawlerRun(mall=mall, success=success, count=count, attempted=attempted,
                              gone=gone, error=error, duration_ms=duration_ms, trigger=trigger))
            db.commit()
    except Exception as exc:  # noqa: BLE001 — 이력 저장 실패는 배치 결과를 죽이지 않도록 무시
        logger.error("배치 %s 이력 저장 실패: %s", mall, type(exc).__name__)


def _run_batch(trigger: str) -> None:
    """전체 몰 배치 실행 (세션 미보유) + 몰별 결과를 새 세션으로 기록.

    배치 완료 후 close_browser() — 512MB OOM 방지 (v0.16.5), 다음 배치 시 재생성된다.
    """
    for mall, runner in _RUNNERS:
        started = time.monotonic()
        try:
            # v0.16.2 (T-119) — run_once 는 (attempted, success) 반환
            # v0.16.8 (T-121) — 4튜플 (attempted, success, gone, error) — 실패 사유 기록
            attempted, count, gone, error = runner()
            duration_ms = int((time.monotonic() - started) * 1000)
            _record_run(mall, trigger, True, count, attempted, gone, error, duration_ms)
            logger.info("배치 %s: %d건 수집 / %d건 시도 / %s (%.1fs)",
                        mall, count, attempted,
                        f"소멸 {gone}건" if gone else "오류 " + error if error else "정상",
                        duration_ms / 1000)
        except Exception as exc:  # noqa: BLE001 — 몰 1건 실패가 워커를 죽이지 않도록 개별 격리
            duration_ms = int((time.monotonic() - started) * 1000)
            _record_run(mall, trigger, False, 0, 0, 0, f"배치 예외: {type(exc).__name__}", duration_ms)
            logger.exception("배치 %s 실패", mall)
        finally:
            close_browser()  # 다음 몰/틱을 위해 크로미움 리소스 해제


def _run_targets(trigger: str) -> None:
    """수집 대상 목록 페이지 순회 (v0.16.16, T-127) — enabled target만.

    각 target 결과를 crawler_runs에 trigger="target"으로 기록. 개별 실패는 다음으로 진행.
    """
    with SessionLocal() as db:
        targets = db.execute(
            select(CrawlTarget).where(CrawlTarget.enabled.is_(True)).order_by(CrawlTarget.id.asc())
        ).scalars().all()
    if not targets:
        return
    for target in targets:
        started = time.monotonic()
        try:
            result = run_target_once(target)
            duration_ms = int((time.monotonic() - started) * 1000)
            _record_run(target.mall, trigger, result["success"], result["count"],
                        0, 0, result["error"], duration_ms)
            logger.info("target %s(%s): %s (%d건, %.1fs)",
                        target.label, target.mall,
                        "성공" if result["success"] else "실패", result["count"], duration_ms / 1000)
        except Exception as exc:  # noqa: BLE001 — target 1건 실패는 전체를 죽이지 않도록 격리
            duration_ms = int((time.monotonic() - started) * 1000)
            _record_run(target.mall, trigger, False, 0, 0, 0, f"target 예외: {type(exc).__name__}", duration_ms)
            logger.exception("target %s 실행 실패", target.label)
        finally:
            close_browser()


def _consume_trigger() -> bool:
    """run_requested 플래그를 새 세션으로 소비. 배치 후 저장된 트리거를 초기화한다."""
    try:
        with SessionLocal() as db:
            cfg = _get_config(db)
            if cfg.run_requested:
                cfg.run_requested = False
                db.commit()
                logger.info("run_requested 소비 (즉시 배치 완료)")
                return True
    except Exception as exc:  # noqa: BLE001 — 소비 실패는 다음 틱에서 재시도
        logger.error("트리거 소비 실패: %s", type(exc).__name__)
    return False


def _run_once_loop() -> None:
    """진입점 분기 도우미 — 메인 루프 공통 처리: 배치 실행 + 트리거 소비."""
    with SessionLocal() as db:
        cfg = _get_config(db)
        requested = cfg.run_requested
    _run_batch(trigger="manual" if requested else "schedule")
    if requested:
        _consume_trigger()
    _run_targets(trigger="manual" if requested else "schedule")


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
            with SessionLocal() as db:  # cfg 읽기는 세션을 짧게 열고 즉시 닫는다 (v0.16.9)
                cfg = _get_config(db)
                requested = cfg.run_requested
                enabled = cfg.enabled
                interval = cfg.interval_seconds

            if requested:
                # 수동 트리거: 즉시 1배치 → 플래그 리셋 (다음 POST까지 중복 방지)
                last_batch_run = time.time()
                _run_batch(trigger="manual")
                _run_targets(trigger="manual")
                _consume_trigger()
            elif enabled and (
                last_batch_run is None or (time.time() - last_batch_run) >= interval
            ):
                # 예약 배치 — 주기는 cfg.interval_seconds (실시간 반영)
                last_batch_run = time.time()
                _run_batch(trigger="schedule")
            else:
                # 비활성/대기 사유를 INFO로 노출 (INFO 레벨 로그로는 안 보이던 문제 해결)
                reason = "수집 비활성 (enabled=false — 설정 탭에서 활성화 또는 1회 실행)"
                if enabled and last_batch_run is not None:
                    remaining = max(0, int(interval - (time.time() - last_batch_run)))
                    reason = f"예약 대기 (다음 배치 {remaining//60}분 후)"
                logger.info("워커 대기: %s", reason)
        except Exception:  # noqa: BLE001 — 배치 실패가 루프를 죽이지 않도록 최상위 격리
            logger.exception("루프 오류")
        time.sleep(TICK_SECONDS)


if __name__ == "__main__":
    main()