# 올리브영 Playwright 크롤러 (v0.3) — HTTP 요청은 TLS 핑거프린팅으로 403 (실측) → headless Chrome으로 교체
# 파싱: og 태그(이름/이미지) + body 텍스트 가격 패턴
# 실측 PoC (2026-08-03): channel="chrome" headless로 가격 39,900원 + og:title/og:image 수집 성공
# 네이버/쿠팡은 서버 크롤링 불가(캡차/Akamai) — 익스텐션 업로드에 의존 (PRD 2장)
# PLATFORM: server
import re
import time
from datetime import datetime, timezone

from app.database import SessionLocal
from app.models import PricePoint, Product

_pw = None
_browser = None

# 실측: 기본 UA는 Cloudflare 챌린지("잠시만 기다리십시오") 차단, Chrome UA로 통과
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)


def _get_browser():
    """브라우저 지연 생성 (채널: 시스템 Chrome — playwright chromium 다운로드 타임아웃 이슈 실측)"""
    global _pw, _browser
    if _browser is None:
        from playwright.sync_api import sync_playwright

        _pw = sync_playwright().start()
        _browser = _pw.chromium.launch(channel="chrome", headless=True)
    return _browser


def fetch_goods(goods_no: str) -> dict | None:
    """올리브영 goodsNo → {name, price, image}. 실패 시 None"""
    url = (
        "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do"
        f"?goodsNo={goods_no}"
    )
    try:
        browser = _get_browser()
        ctx = browser.new_context(user_agent=UA, locale="ko-KR")
        page = ctx.new_page()
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(5000)  # SPA 렌더 + 봇 챌린지 통과 대기 (실측)
        body_text = page.evaluate("document.body ? document.body.innerText : ''")
        name_match = page.query_selector('meta[property="og:title"]')
        image_match = page.query_selector('meta[property="og:image"]')
        name = name_match.get_attribute("content") if name_match else None
        image = image_match.get_attribute("content") if image_match else None
        ctx.close()
    except Exception:
        return None

    if not name:
        return None

    # 가격: ① body "N,NNN원" ② tx_num ③ data-qa 할인가
    price = None
    m = re.search(r"([0-9][0-9,]*)\s*원", body_text)
    if m:
        price = int(m.group(1).replace(",", ""))
    if not price:
        tx = re.search(r'<em class="tx_num">([0-9,]+)</em>', body_text)
        if tx:
            price = int(tx.group(1).replace(",", ""))
    if not price:
        return None

    return {
        "name": name,
        "image": image,
        "price": price,
        "checked_at": time.time(),
    }


def run_once() -> int:
    """갱신 만료된 올리브영 상품 1배치 수집. 성공 수 반환"""
    from crawlers.worker import CRAWLABLE_MALLS

    now = time.time()
    with SessionLocal() as db:
        candidates = db.query(Product) \
            .filter(Product.mall.in_(CRAWLABLE_MALLS)) \
            .order_by(Product.last_checked_at.asc().nulls_first()) \
            .limit(10 * 3) \
            .all()

    stale = []
    for p in candidates:
        if p.last_checked_at is None:
            stale.append(p)
            continue
        if now - p.last_checked_at.timestamp() > 60 * 60:
            stale.append(p)

    success = 0
    for product in stale[:10]:
        if product.id.startswith("oyrun:"):
            continue
        result = fetch_goods(product.id)
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
            print(f"수집 완료: {fresh.id} → {result['price']}원")
            success += 1
    return success
