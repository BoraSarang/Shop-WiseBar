# 올리브영 Playwright 크롤러 (v0.16.7) — HTTP 요청은 TLS 핑거프린팅으로 403 (실측) → headless Chrome으로 교체
# 파싱: og 태그(이름/이미지) + body 텍스트 가격 패턴
# 실측 PoC (2026-08-03): channel="chrome" headless로 가격 39,900원 + og:title/og:image 수집 성공
# 네이버/쿠팡은 서버 크롤링 불가(캡차/Akamai) — 익스텐션 업로드에 의존 (PRD 2장)
# v0.16.7 (T-120i): 소멸 상품(판매종료) 감지 — 반환 dict에 status 추가. run_once는 gone이면
#   last_checked_at 갱신만 해 다음 배치 재시도 방지 (운영: 소멸 상품이 1시간마다 0건 반복 실측).
# PLATFORM: server
import logging
import re
import time
from datetime import datetime, timezone

from app.database import SessionLocal
from app.models import PricePoint, Product
from crawlers._browser import new_context

logger = logging.getLogger("crawler")

# 실측: 기본 UA는 Cloudflare 챌린지("잠시만 기다리십시오") 차단, Chrome UA로 통과
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

# 소멸 페이지 표식 (운영·로컬 실측): og:title="올리브영 온라인몰" + body "찾을 수 없"
_GONE_TITLE = "올리브영 온라인몰"


def fetch_goods(goods_no: str) -> dict | None:
    """올리브영 goodsNo → {status: "ok", name, price, image} | {status:"gone"} | None(오류).

    status:
      "ok"   — 정상 수집
      "gone" — 판매종료/삭제 상품 (다음 배치 재시도 방지하려면 last_checked_at 갱신)
      None   — 일시 오류 (챌린지 미해결/타임아웃 등 → 다음 배치에서 재시도)

    Cloudflare 챌린지 대응 (v0.16.6): "잠시만 기다려 주세요... 접속 정보를 확인 중" 페이지가 뜨면
    브라우저에서 JS 챌린지가 자동 해결될 때까지 5초 간격 최대 3회 재대기 후 재확인.
    """
    url = (
        "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do"
        f"?goodsNo={goods_no}"
    )
    try:
        ctx = new_context(user_agent=UA, locale="ko-KR")
        try:
            page = ctx.new_page()
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            # 챌린지 페이지면 자동 해결까지 대기 (v0.16.6)
            for _ in range(4):
                page.wait_for_timeout(5000)  # SPA 렌더 + 봇 챌린지 통과 대기 (실측)
                body_text = page.evaluate("document.body ? document.body.innerText : ''")
                challenge = "잠시만 기다려" in body_text or "접속 정보를 확인" in body_text
                if not challenge:
                    break
                logger.info("올리브영 챌린지 대기 중 goodsNo=%s (%d회)", goods_no, _ + 1)
            name_match = page.query_selector('meta[property="og:title"]')
            image_match = page.query_selector('meta[property="og:image"]')
            name = name_match.get_attribute("content") if name_match else None
            image = image_match.get_attribute("content") if image_match else None
        finally:
            ctx.close()  # 컨텍스트 누적으로 인한 메모리 누적 방지 (운영 OOM 대응)
    except Exception as exc:
        logger.warning("올리브영 fetch 실패 goodsNo=%s: %s", goods_no, exc)
        return None

    if not name:
        # 진단: og:title 없음 = 봇 챌린지/블록 페이지 등 가능성
        logger.warning(
            "올리브영 og:title 없음 goodsNo=%s body=%d자 (%s...)", goods_no,
            len(body_text), body_text[:60].replace("\n", " "),
        )
        return None

    # 소멸(판매종료) 감지 — og:title이 몰 페이지 제목이면 상품이 없음 (운영 실측)
    if name == _GONE_TITLE or "찾을 수 없" in body_text:
        logger.info("올리브영 소멸 상품(재시도 방지) goodsNo=%s", goods_no)
        return {"status": "gone"}

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
        logger.warning(
            "올리브영 가격 미발견 goodsNo=%s body=%d자 (%s...)", goods_no,
            len(body_text), body_text[:60].replace("\n", " "),
        )
        return {"status": "gone"} if "찾을 수 없" in body_text else None

    return {
        "status": "ok",
        "name": name,
        "image": image,
        "price": price,
        "checked_at": time.time(),
    }


def run_once() -> tuple[int, int]:
    """갱신 만료된 올리브영 상품 1배치 수집.

    반환: (attempted, success) — v0.16.2 (T-119): 시도한 건수(성공+실패)와 성공 건수.
    실패(시도-성공)에는 fetch 실패(None)와 저장 실패가 포함된다.
    """
    now = time.time()
    with SessionLocal() as db:
        candidates = db.query(Product) \
            .filter(Product.mall == "oliveyoung") \
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

    attempted = 0
    success = 0
    for product in stale[:3]:  # 배치 3건 — Render 512MB 메모리 예산 (v0.16.5)
        if product.id.startswith("oyrun:"):
            continue
        attempted += 1  # 실제 fetch 시도 1건
        result = fetch_goods(product.id)
        if result is None:
            continue  # 일시 오류 — 다음 배치에서 재시도
        if result["status"] == "gone":
            # 소멸(판매종료) — 가격 없이 last_checked_at만 갱신해 1시간마다 재시도 중단 (v0.16.7)
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
            print(f"수집 완료: {fresh.id} → {result['price']}원")
            success += 1
    return attempted, success
