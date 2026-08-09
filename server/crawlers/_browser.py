# 브라우저 공용 실행 (v0.16.3, T-120) — 시스템 Chrome 우선, 없으면 Playwright 번들 Chromium 폴백
# 원인: Render 컨테이너(Linux)엔 시스템 Chrome이 없어 `channel="chrome"` launch가 즉시 실패
#   → 운영 크롤러 전수 실패(oliveyoung 10/10, naver 5/5, 0.9초) 실측 (2026-08-10)
# 폴백1: playwright 번들 Chromium (`python -m playwright install chromium`) — 컨테이너에 미설치면 최초 실행 시 자가 설치
# 폴백2: 설치 후에도 launch 실패 시 `--with-deps`로 OS 의존성까지 설치 재시도 (root 불필요한 chromium만 우선)
# PLATFORM: server
import logging
import subprocess
import sys

logger = logging.getLogger("crawler")

_pw = None
_browser = None

# 파이썬 실행 파일 (Render의 playwright CLI 경로)
_PY = sys.executable or "python"


def _install_bundled():
    """번들 Chromium을 playwright 캐시에 설치. 실패해도 예외로 쓰러지지 않음."""
    try:
        r = subprocess.run(
            [_PY, "-m", "playwright", "install", "chromium"],
            capture_output=True,
            text=True,
            timeout=600,
        )
        if r.returncode != 0:
            logger.warning("playwright install chromium 실패 rc=%s: %s",
                           r.returncode, (r.stderr or r.stdout)[-300:])
        else:
            logger.info("playwright chromium 설치 완료")
    except Exception as exc:  # noqa: BLE001
        logger.warning("playwright install chromium 예외: %s", exc)


def get_browser():
    """브라우저 지연 생성 + 자가 설치.

    우선순위: ① 시스템 Chrome(로컬 macOS) ② 번들 Chromium(Render) ③ 부재 시 download 후 재시도.
    """
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
            try:
                _browser = _pw.chromium.launch(headless=True)
            except Exception:
                _install_bundled()
                try:
                    _browser = _pw.chromium.launch(headless=True)
                except Exception:
                    # OS 의존성 부족 등 가장 무거운 사후수단 — 보통 root 필요
                    logger.warning("번들 Chromium 미가동 → --with-deps 재설치 시도")
                    subprocess.run(
                        [_PY, "-m", "playwright", "install", "--with-deps", "chromium"],
                        capture_output=True, text=True, timeout=600,
                    )
                    _browser = _pw.chromium.launch(headless=True)
            logger.info("브라우저: Playwright 번들 Chromium")
    return _browser