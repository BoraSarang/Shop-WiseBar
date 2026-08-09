# 브라우저 공용 실행 (v0.16.3, T-120) — 시스템 Chrome 우선, 없으면 Playwright 번들 Chromium 폴백
# 원인: Render 컨테이너(Linux)엔 시스템 Chrome이 없어 `channel="chrome"` launch가 즉시 실패
#   → 운영 크롤러 전수 실패(oliveyoung 10/10, naver 5/5, 0.9초) 실측 (2026-08-10)
# 폴백: playwright 번들 Chromium (`python -m playwright install chromium`) — 운영 빌드 명령에서 사전 설치
# PLATFORM: server
import logging

logger = logging.getLogger("crawler")

_pw = None
_browser = None


def get_browser():
    """브라우저 지연 생성. 시스템 Chrome이 있으면 우선 사용, 없으면 번들 Chromium 폴백."""
    global _pw, _browser
    if _browser is None:
        from playwright.sync_api import sync_playwright

        _pw = sync_playwright().start()
        try:
            # 로컬 macOS: 시스템 Chrome (실측 최종 수순 — 기본 UA 차단 회피에 유리)
            _browser = _pw.chromium.launch(channel="chrome", headless=True)
            logger.info("브라우저: 시스템 Chrome")
        except Exception as exc:  # noqa: BLE001 — Chrome 미설치(Render 등)면 번들 Chromium 재시도
            logger.warning("시스템 Chrome 없음(%s) → Playwright 번들 Chromium 폴백", exc)
            _browser = _pw.chromium.launch(headless=True)
            logger.info("브라우저: Playwright 번들 Chromium")
    return _browser