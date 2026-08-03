# 크롤러 워커 (v0.3) — 갱신이 오래된 올리브영 상품 자동 수집 (Playwright)
# 실행: `python run_crawler.py` (uvicorn과 별도 프로세스)
# 주기: 30분, 배치: 상품 10개/회 (last_checked_at 오래된 순)
# PLATFORM: server
import logging
import time

from crawlers.oliveyoung import run_once

logging.basicConfig(level=logging.INFO, format="%(asctime)s [CRAWLER] %(message)s")
logger = logging.getLogger("crawler")

INTERVAL_SECONDS = 30 * 60


def main() -> None:
    logger.info("크롤러 워커 시작 (주기 %ss)", INTERVAL_SECONDS)
    while True:
        try:
            success = run_once()
            if success:
                logger.info("배치 완료: %d건 수집", success)
        except Exception:
            logger.exception("배치 실패")
        time.sleep(INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
