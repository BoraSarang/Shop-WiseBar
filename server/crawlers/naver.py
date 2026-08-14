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
from datetime import datetime, timezone

from app.database import SessionLocal
from app.models import PricePoint, Product
from crawlers._browser import close_context, new_context

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
                # v0.16.17: networkidle(45s) → domcontentloaded(30s) — 네이버 상품 페이지는
                # 광고/추적 스크립트가 계속 로드되어 networkidle이 잘 뜨지 않아 상품당 10s+ 지연.
                # 가격은 아래 스크롤 대기 루프가 커버 (JS 지연 렌더링 — 실측)
                page.goto(url, wait_until="domcontentloaded", timeout=30000)
            except Exception:
                page.goto(url, wait_until="domcontentloaded", timeout=30000)  # 타임아웃 폴백
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


def run_once() -> tuple[int, int, int, str | None]:
    """가격이 오래된 네이버 상품 1배치 수집.

    반환: (attempted, success, gone, error) — v0.16.8 (T-121):
      attempted 시도 / success 성공 / gone 상품없음 / error 실패 사유(없으면 None).
    대상 URL이 아닌 후보(brand.naver.com 외)는 시도 수에 포함하지 않는다.
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
    attempted = 0
    success = 0
    gone = 0
    errors: list[str] = []
    batch = [p for p in stale[:batch_limit] if p.url and "naver.com" in p.url and "brand.naver.com" in p.url]
    logger.info("네이버 수집 대상 %d건 (스테일 %d건)", len(batch), len(stale))
    for i, product in enumerate(batch, start=1):
        attempted += 1  # 실제 fetch 시도 1건
        logger.info("네이버 수집 시도 %d/%d %s", i, len(batch), product.id)
        t0 = time.monotonic()
        result = fetch(product.url)
        dt = time.monotonic() - t0
        if result is None or result.get("status") is None:
            errors.append(result["error"] if result else "알 수 없는 오류")
            logger.warning("네이버 수집 실패 %d/%d %s (%.1fs) — %s", i, len(batch), product.id, dt,
                           result["error"] if result else "알 수 없는 오류")
            continue
        if result["status"] == "gone":
            gone += 1  # 상품 삭제 — 실패로 취급하지 않음 (v0.16.8)
            logger.info("네이버 소멸 %d/%d %s (%.1fs)", i, len(batch), product.id, dt)
            # last_checked_at만 갱신해 1시간마다 재시도 중단 (v0.16.7)
            with SessionLocal() as db:
                fresh = db.get(Product, product.id)
                if fresh is None:
                    continue
                fresh.last_checked_at = datetime.now(timezone.utc)
                db.commit()
            continue
        with SessionLocal() as db:
            fresh = db.get(Product, product.id)
            if fresh is None:
                continue
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
            logger.info("네이버 수집 완료 %d/%d %s → %s원 (%.1fs)", i, len(batch), fresh.id, result["price"], dt)
            success += 1
    return attempted, success, gone, "; ".join(dict.fromkeys(errors)) or None