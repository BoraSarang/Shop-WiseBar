# 올리브영 HTTP 크롤러 (P5-T55) — 클라이언트 OliveYoungFetcher 로직의 서버 포팅
# 파싱: og 태그(이름/이미지) + salePrice/data-qa/tx_num 가격 패턴
# 네이버/쿠팡은 브라우저 세션 필요 → 서버 크롤러 제외 (하이브리드: 클라이언트 업로드에 의존)
# PLATFORM: server
import re
import time

import httpx

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    "Accept-Language": "ko-KR,ko;q=0.9",
}


def fetch_goods(goods_no: str) -> dict | None:
    """올리브영 goodsNo → {name, price, image}. 실패 시 None"""
    url = (
        "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do"
        f"?goodsNo={goods_no}"
    )
    try:
        resp = httpx.get(url, headers=HEADERS, timeout=10, follow_redirects=True)
        resp.raise_for_status()
    except Exception:
        return None

    html = resp.text
    # 이름/이미지: og 태그
    name_match = re.search(r'<meta property="og:title" content="([^"]+)"', html)
    if not name_match:
        return None
    image_match = re.search(r'<meta property="og:image" content="([^"]+)"', html)

    # 가격: ① Next.js salePrice ② data-qa discount-price ③ tx_num 레거시
    price_match = (
        re.search(r'salePrice\\":(\d+)', html)
        or re.search(
            r'data-qa-name="text-product-discount-price"><span>([0-9,]+)</span>',
            html,
        )
        or re.search(r'판매가[\s\S]{0,300}?<em class="tx_num">([0-9,]+)</em>', html)
        or re.search(r'<em class="tx_num">([0-9,]+)</em>', html)
    )
    if not price_match:
        return None

    return {
        "name": name_match.group(1),
        "image": image_match.group(1) if image_match else None,
        "price": int(price_match.group(1).replace(",", "")),
        "checked_at": time.time(),
    }
