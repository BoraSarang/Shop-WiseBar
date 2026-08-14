# 네이버 크롤러 (v0.16.5) — 브랜드스토어 상품 자동 수집 (Playwright)
# 2차 검증 실측 (2026-08-10, ShopWiseBar-Verify): channel="chrome" headless + Chrome UA +
#   wait_until="networkidle" + 가격 텍스트 대기 스크롤(최대 5회) → 캡차 없이 이름+가격 수집 성공 3건
#   (1차 PoC는 캡차 "보안 확인"으로 실패 → v0.16.0에서 아키텍처 갱신: docs/plans/PLAN_v0.16.0_naver-crawler.md)
# 대상: brand.naver.com (브랜드스토어). smartstore.naver.com 은 후속 단계.
# PLATFORM: server
import logging
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

from app.database import SessionLocal
from app.models import PricePoint, Product
from crawlers._browser import close_browser, close_context, new_context

logger = logging.getLogger("crawler")

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

# 가격이 즉시 안 뜨면 스크롤하며 최대 attempts 회 대기 (네이버 상품 페이지는 JS 지연 렌더링 — 실측)
MAX_PRICE_WAIT = 5
PRICE_RE = re.compile(r"([0-9][0-9,]*)\s*원")

# 가격 오탐 방어 (v0.16.17) — body 첫 "N원" 매칭이 결제 금액·적립 등 실제가 아닌 값을
# 잡는 사례(운영 실측 2026-08-14, 6자리 오탐)가 있어 1,000원 미만은 폐기한다.
MIN_PRICE = 1_000


def _extract_price(text: str) -> int | None:
    m = PRICE_RE.search(text)
    if not m:
        return None
    return int(m.group(1).replace(",", ""))


def fetch(url: str) -> dict | None:
    """네이버 브랜드스토어 상품 URL → {status, name, price, image}. 오류 시 사유 dict.

    status: "ok" — 정상 수집 / "gone" — 상품 삭제·변경 (재시도 방지 위해 run_once가 last_checked_at 갱신).
    실패 시 None 대신 {status:None, error:사유} 반환 — run_once가 실패 사유를 이력에 기록 (v0.16.8, T-121).
    """
    try:
        ctx = new_context(user_agent=UA, locale="ko-KR")
        try:
            page = ctx.new_page()
            price = None
            body_text = ""
            try:
                # v0.16.17: networkidle 유지 — domcontentloaded 시도는 브랜드스토어 SPA
                # 미로드로 가격 미발견 회귀(운영 실측: 기존 성공 상품까지 body 100자대 실패).
                # 네이버 속도 병목은 networkidle이 아니라 컨텍스트 생성/페이지 로드 자체임(실측 9.6s→8.9s 무의미).
                page.goto(url, wait_until="networkidle", timeout=45000)  # 가격 지연 로드 대기 (실측)
            except Exception:
                page.goto(url, wait_until="domcontentloaded", timeout=30000)  # networkidle 타임아웃 폴백
            # 가격 텍스트가 뜰 때까지 스크롤 대기
            for _ in range(MAX_PRICE_WAIT):
                body_text = page.evaluate("document.body ? document.body.innerText : ''")
                price = _extract_price(body_text)
                if price:
                    break
                page.evaluate("window.scrollBy(0, 600)")
                page.wait_for_timeout(1000)
            # 챌린지(보안/캡차) 감지 — 진입이 차단되면 가격 추출을 신뢰하지 않음
            if any(k in body_text for k in ("보안 확인", "완료하세요", "캡차")) or "captcha" in body_text.lower():
                logger.warning("네이버 챌린지 차단 %s", url)
                return {"status": None, "error": "챌린지/캡차 차단"}
            # 오탐 가격(1,000원 미만)은 저장하지 않는다 — 실제가 아님 (v0.16.17)
            if price is not None and price < MIN_PRICE:
                logger.warning("네이버 가격 오탐 %s: %s원 (1,000원 미만) → 폐기", url, price)
                price = None
            if not price:
                gone = "존재하지 않습니다" in body_text  # 상품 삭제/변경 (운영 실측)
                logger.warning(
                    "네이버 가격 미발견 %s body=%d자 (%s...) %s", url,
                    len(body_text), body_text[:60].replace("\n", " "),
                    "→ 소멸" if gone else "",
                )
                if gone:
                    return {"status": "gone"}
                return {"status": None, "error": f"가격 미발견 body={len(body_text)}자"}

            name_match = page.query_selector('meta[property="og:title"]')
            image_match = page.query_selector('meta[property="og:image"]')
            name = name_match.get_attribute("content") if name_match else None
            image = image_match.get_attribute("content") if image_match else None
        finally:
            close_context(ctx)  # Browserless 재사용 컨텍스트는 닫지 않고 페이지만 정리 (v0.16.13)
    except Exception as exc:
        logger.warning("네이버 fetch 실패 %s: %s", url, exc)
        return {"status": None, "error": f"브라우저 오류: {type(exc).__name__}"}

    if not name:
        logger.warning("네이버 og:title 없음 %s", url)
        return {"status": None, "error": "og:title 없음"}

    return {"status": "ok", "name": name, "image": image, "price": price, "checked_at": time.time()}


def _parallel_workers() -> int:
    """네이버 병렬 fetch 워커 수 — 기본 순차(1) (v0.16.17).

    병렬(Chrome 다중 동시 접속) 시 네이버 IP 차단으로 실패율 급증 (운영 실측 2026-08-14:
    CRAWLER_PARALLEL=3 → 30건 중 TimeoutError·가격 미발견 다발). 올리브영과 달리
    네이버는 스마트스토어/브랜드스토어가 동시 접속을 강하게 제한한다.
    명시적으로 CRAWLER_PARALLEL을 설정한 경우에만 병렬 허용.
    """
    return int(os.environ.get("CRAWLER_PARALLEL", "1"))


def _process(product: Product, index: int, total: int) -> tuple[str, str, float]:
    """단일 상품 fetch + DB 반영 — 병렬 워커 스레드에서 호출 (스레드 로컬 브라우저 + 새 세션이라 안전).

    반환: (result_kind, detail, dt) — result_kind: "ok" / "gone" / "error".
    """
    logger.info("네이버 수집 시도 %d/%d %s", index, total, product.id)
    t0 = time.monotonic()
    result = fetch(product.url)
    dt = time.monotonic() - t0
    if result is None or result.get("status") is None:
        err = result["error"] if result else "알 수 없는 오류"
        logger.warning("네이버 수집 실패 %d/%d %s (%.1fs) — %s", index, total, product.id, dt, err)
        return ("error", err, dt)
    if result["status"] == "gone":
        logger.info("네이버 소멸 %d/%d %s (%.1fs)", index, total, product.id, dt)
        # last_checked_at만 갱신해 1시간마다 재시도 중단 (v0.16.7)
        with SessionLocal() as db:
            fresh = db.get(Product, product.id)
            if fresh is None:
                return ("error", "상품 삭제됨", dt)
            fresh.last_checked_at = datetime.now(timezone.utc)
            db.commit()
        return ("gone", product.id, dt)
    with SessionLocal() as db:
        fresh = db.get(Product, product.id)
        if fresh is None:
            return ("error", "상품 삭제됨", dt)
        point = PricePoint(
            product_id=fresh.id,
            price=result["price"],
            source="crawler",
            captured_at=datetime.now(timezone.utc),
        )
        db.add(point)
        fresh.last_price = result["price"]
        fresh.last_checked_at = point.captured_at
        if result["name"] and not fresh.name:
            fresh.name = result["name"]
        if result["image"] and not fresh.image:
            fresh.image = result["image"]
        db.commit()
        logger.info("네이버 수집 완료 %d/%d %s → %s원 (%.1fs)", index, total, fresh.id, result["price"], dt)
    return ("ok", fresh.id, dt)


def run_once() -> tuple[int, int, int, str | None]:
    """가격이 오래된 네이버 상품 1배치 수집.

    반환: (attempted, success, gone, error) — v0.16.8 (T-121):
      attempted 시도 / success 성공 / gone 상품없음 / error 실패 사유(없으면 None).
    대상 URL이 아닌 후보(brand.naver.com 외)는 시도 수에 포함하지 않는다.
    로컬 워커는 CRAWLER_PARALLEL(기본 3) 병렬 fetch (v0.16.17) — 배치 시간 1/2~1/3 단축.
    """
    now = time.time()
    with SessionLocal() as db:
        candidates = db.query(Product) \
            .filter(Product.mall == "naver", Product.url.like("%brand.naver.com%")) \
            .order_by(Product.last_checked_at.asc().nulls_first()) \
            .limit(10 * 3) \
            .all()

    stale = []
    for p in candidates:
        if p.id.startswith("demo:"):  # 부하테스트 데이터는 스킵
            continue
        if p.last_checked_at is None:
            stale.append(p)
            continue
        if now - p.last_checked_at.timestamp() > 60 * 60:
            stale.append(p)

    # 배치 크기 — 기본 3건(Render 512MB 메모리 예산, v0.16.5).
    # 로컬 워커는 CRAWLER_BATCH_LIMIT로 확대 (시스템 Chrome + 메모리 제약 없음, v0.16.16).
    batch_limit = int(os.environ.get("CRAWLER_BATCH_LIMIT", "3"))
    batch = [p for p in stale[:batch_limit] if p.url and "naver.com" in p.url and "brand.naver.com" in p.url]
    logger.info("네이버 수집 대상 %d건 (스테일 %d건)", len(batch), len(stale))
    if not batch:
        return 0, 0, 0, None

    workers = _parallel_workers()
    indexed = list(enumerate(batch, start=1))
    total = len(batch)
    attempted = total
    success = 0
    gone = 0
    errors: list[str] = []

    def _collect(kind: str, detail: str) -> None:
        nonlocal success, gone
        if kind == "ok":
            success += 1
        elif kind == "gone":
            gone += 1
        else:
            errors.append(detail)

    if workers > 1:
        # 라운드로빈 청크 분배 — 스레드마다 자체 브라우저가 뜨므로 브라우저는 재사용하고
        # 청크 처리 후 해당 스레드의 리소스를 정리한다 (close_browser는 스레드 로컬).
        chunks = [indexed[i::workers] for i in range(workers)]

        def _run_chunk(chunk):
            try:
                return [_process(p, idx, total) for idx, p in chunk]
            finally:
                close_browser()  # 워커 스레드 브라우저 정리 (다음 배치에서 재생성)

        with ThreadPoolExecutor(max_workers=workers) as ex:
            futures = [ex.submit(_run_chunk, c) for c in chunks if c]
            for fut in futures:
                for kind, detail, _dt in fut.result():
                    _collect(kind, detail)
    else:
        for idx, product in indexed:
            _collect(*_process(product, idx, total)[:2])
    return attempted, success, gone, "; ".join(dict.fromkeys(errors)) or None