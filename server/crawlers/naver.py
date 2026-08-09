# 네이버 크롤러 (v0.16.0) — 브랜드스토어 상품 자동 수집 (Playwright)
# 2차 검증 실측 (2026-08-10, ShopWiseBar-Verify): channel="chrome" headless + Chrome UA +
#   wait_until="networkidle" + 가격 텍스트 대기 스크롤(최대 5회) → 캡차 없이 이름+가격 수집 성공 3건
#   (1차 PoC는 캡차 "보안 확인"으로 실패 → v0.16.0에서 아키텍처 갱신: docs/plans/PLAN_v0.16.0_naver-crawler.md)
# 대상: brand.naver.com (브랜드스토어). smartstore.naver.com 은 후속 단계.
# PLATFORM: server
import re
import time
from datetime import datetime, timezone

from app.database import SessionLocal
from app.models import PricePoint, Product

_pw = None
_browser = None

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

# 가격이 즉시 안 뜨면 스크롤하며 최대 attempts 회 대기 (네이버 상품 페이지는 JS 지연 렌더링 — 실측)
MAX_PRICE_WAIT = 5
PRICE_RE = re.compile(r"([0-9][0-9,]*)\s*원")


def _get_browser():
    """브라우저 지연 생성 (채널: 시스템 Chrome — Playwright chromium 다운로드 타임아웃 이슈 실측)"""
    global _pw, _browser
    if _browser is None:
        from playwright.sync_api import sync_playwright

        _pw = sync_playwright().start()
        _browser = _pw.chromium.launch(channel="chrome", headless=True)
    return _browser


def _extract_price(text: str) -> int | None:
    m = PRICE_RE.search(text)
    if not m:
        return None
    return int(m.group(1).replace(",", ""))


def fetch(url: str) -> dict | None:
    """네이버 브랜드스토어 상품 URL → {name, price, image}. 실패/챌린지 시 None"""
    try:
        browser = _get_browser()
        ctx = browser.new_context(user_agent=UA, locale="ko-KR")
        page = ctx.new_page()
        with_prices = []
        try:
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
        else:
            price = None
        if not price:
            ctx.close()
            return None

        # 챌린지(보안/캡차) 감지 — 진입이 차단되면 가격 추출을 신뢰하지 않음
        if any(k in body_text for k in ("보안 확인", "완료하세요", "캡차")) or "captcha" in body_text.lower():
            ctx.close()
            return None

        name_match = page.query_selector('meta[property="og:title"]')
        image_match = page.query_selector('meta[property="og:image"]')
        name = name_match.get_attribute("content") if name_match else None
        image = image_match.get_attribute("content") if image_match else None
        ctx.close()
    except Exception:
        return None

    if not name:
        return None

    return {"name": name, "image": image, "price": price, "checked_at": time.time()}


def run_once() -> tuple[int, int]:
    """가격이 오래된 네이버 상품 1배치 수집.

    반환: (attempted, success) — v0.16.2 (T-119): URL 필터 통과 후 실제 fetch 시도한 수와 성공 수.
    대상 URL이 아닌 후보(brand.naver.com 외)는 시도 수에 포함하지 않는다.
    """
    now = time.time()
    with SessionLocal() as db:
        candidates = db.query(Product) \
            .filter(Product.mall == "naver") \
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

    attempted = 0
    success = 0
    for product in stale[:10]:
        # 네이버 전용: 브랜드/스마트스토어 URL만 대상
        if not (product.url and "naver.com" in product.url and "brand.naver.com" in product.url):
            continue
        attempted += 1  # 실제 fetch 시도 1건
        result = fetch(product.url)
        if result is None:
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
            print(f"네이버 수집: {fresh.id} → {result['price']}원")
            success += 1
    return attempted, success