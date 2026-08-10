# 브라우저 공용 실행 (v0.16.5, T-120) — 시스템 Chrome 우선, 없으면 Playwright 번들 Chromium 폴백
# 1차 원인(운영 실측): Render 컨테이너에 시스템 Chrome 없음 → channel="chrome" launch 즉시 실패 → 전수 실패
# 2차(운영 실측): Render 빌드가 pip만 실행 → chromium 이진파일 미존재 → 번들 폴백도 실패
# 3차(운영 실측, v0.16.5): 브라우저는 실행되나 배치 중 OOM(512MB 초과) — 크로미움 렌더러 누적 + 이미지/폰트 전량 로드.
#   → 배치 후 close_browser()로 메모리 해제 + 컨텍스트 리소스(이미지/미디어/폰트/광고) 차단으로 경량화.
# 해결(정석): render.yaml 블루프린트로 빌드 시 `python -m playwright install --with-deps chromium` 실행 (root로 OS deps 설치)
# PLATFORM: server
import logging
import subprocess
import sys

logger = logging.getLogger("crawler")

_pw = None
_browser = None

_PY = sys.executable or "python"

# 컨테이너(Render) 크로미움 launch 인자 — 샌드박스 비활성·/dev/shm 오프셋·GPU 비활성 (메모리/안정성)
# AutomationControlled 비활성: Cloudflare 챌린지가 navigator.webdriver로 헤드리스 봇 감지하는 것 회피 (v0.16.6)
_LAUNCH_ARGS = [
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--disable-blink-features=AutomationControlled",
]

# 텍스트 크롤러는 og 태그/body 텍스트만 필요 → 이미지·미디어·폰트·광고·추적기는 차단 (메모리·대역폭 절감)
_BLOCK_RESOURCE_TYPES = {"image", "media", "font"}
_BLOCK_URL_HINTS = ("doubleclick", "google-analytics", "googletagmanager", "/ads/", "adservice")


def _install_bundled(with_deps: bool = False):
    """번들 Chromium 상정. 설치 실패는 예외로 전파하지 않고 로그만 남긴다.

    with_deps=False: chromium만 다운로드 (root 불필요, Render 무료 티어 OK)
    with_deps=True: OS 의존성까지 apt-get 설치 (root 필요) — 일반 워커에선 stdin 차단+짧은 timeout으로
        sudo 프롬프트 블로킹을 방지해 신속히 실패시키고, 빌드 시 설치를 권장한다.
    """
    cmd = [_PY, "-m", "playwright", "install"]
    if with_deps:
        cmd.append("--with-deps")
    cmd.append("chromium")
    kwargs = dict(capture_output=True, text=True, stdin=subprocess.DEVNULL, timeout=180)
    try:
        r = subprocess.run(cmd, **kwargs)
        if r.returncode != 0:
            logger.warning("playwright install%s 실패 rc=%s: %s",
                           " --with-deps" if with_deps else "", r.returncode,
                           (r.stderr or r.stdout)[-400:])
            return False
        logger.info("playwright chromium%s 설치 완료", " (+deps)" if with_deps else "")
        return True
    except subprocess.TimeoutExpired:
        logger.error("playwright install%s 타임아웃(180s) — Render 빌드 명령에서 설치 필요",
                     " --with-deps" if with_deps else "")
        return False
    except Exception as exc:  # noqa: BLE001
        logger.warning("playwright install 예외: %s", exc)
        return False


def get_browser():
    """브라우저 지연 생성 + 자가 설치(백업).

    우선순위: ① 시스템 Chrome(로컬 macOS) ② 번들 Chromium(Render) ③ 부재 시 download 후 재시도.
    ④ 그래도 실패하면 --with-deps 시도는 안전하게 실패시키고(블로킹 방지) launch 실패를 그대로 노출.
    """
    global _pw, _browser
    if _browser is not None:
        return _browser

    from playwright.sync_api import sync_playwright

    _pw = sync_playwright().start()
    try:
        # 로컬 macOS: 시스템 Chrome (실측 — 기본 UA 차단 회피에 유리)
        _browser = _pw.chromium.launch(channel="chrome", headless=True, args=_LAUNCH_ARGS)
        logger.info("브라우저: 시스템 Chrome")
    except Exception as exc:  # noqa: BLE001 — Chrome 미설치(Render 등)면 번들 Chromium 재시도
        logger.warning("시스템 Chrome 없음(%s) → Playwright 번들 Chromium 폴백", exc)
        try:
            _browser = _pw.chromium.launch(headless=True, args=_LAUNCH_ARGS)
        except Exception:
            _install_bundled(with_deps=False)
            try:
                _browser = _pw.chromium.launch(headless=True, args=_LAUNCH_ARGS)
            except Exception as final_exc:  # noqa: BLE001
                # OS deps 부족이 원인일 수 있으나 root가 아니면 전용 설치가 불가.
                # 블로킹(600s) 대신 짧게 실패시키고, 설치 처방을 로그로 안내한다.
                _install_bundled(with_deps=True)
                try:
                    _browser = _pw.chromium.launch(headless=True, args=_LAUNCH_ARGS)
                except Exception:
                    logger.error(
                        "번들 Chromium launch 실패: %s — Render 'Build Command'에 "
                        "'python -m playwright install --with-deps chromium' 추가가 필요합니다",
                        final_exc,
                    )
                    raise
        logger.info("브라우저: Playwright 번들 Chromium")
    return _browser


def close_browser():
    """브라우저/Playwright 리소스 해제 — 배치 완료 후 호출해 512MB OOM(운영 실측) 방지."""
    global _pw, _browser
    if _browser is not None:
        try:
            _browser.close()
        except Exception:  # noqa: BLE001 — 해제 실패는 무시 (다음 배치에서 재생성)
            logger.warning("브라우저 종료 중 예외 (무시)", exc_info=True)
        _browser = None
    if _pw is not None:
        try:
            _pw.stop()
        except Exception:  # noqa: BLE001
            logger.warning("playwright 종료 중 예외 (무시)", exc_info=True)
        _pw = None
    logger.info("브라우저 리소스 해제 완료")


def new_context(user_agent: str, locale: str = "ko-KR"):
    """경량 컨텍스트 생성 — 이미지/미디어/폰트/광고 요청을 차단해 메모리·대역폭 절감.

    body 텍스트와 og 메타 태그는 영향받지 않는다 (텍스트 크롤러 용도에 충분).
    """
    browser = get_browser()
    ctx = browser.new_context(user_agent=user_agent, locale=locale)

    def _route_handler(route):
        req = route.request
        if req.resource_type in _BLOCK_RESOURCE_TYPES or any(
            hint in req.url for hint in _BLOCK_URL_HINTS
        ):
            route.abort()
        else:
            route.continue_()

    ctx.route("**/*", _route_handler)
    return ctx
