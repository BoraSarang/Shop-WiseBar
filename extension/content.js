// content.js — 상품 페이지 URL 파싱 + DOM 가격/제목/이미지 추출
// 기존 맥 메뉴바 MallParser/BrowserSessionFetcher 로직을 JS로 포팅 (실측 패턴 유지)
// E-EXT-URL-2001: 지원하지 않는 상품 페이지 / E-EXT-VALID-3001: 추출 실패
// MallParser는 common.js에서 제공

const Extractor = {
  ogMeta(prop) {
    const el = document.querySelector(`meta[property="${prop}"]`);
    return el && el.content ? el.content : null;
  },
  // body.innerText에서 "N,NNN원" 형식 숫자 중 가장 큰 값 (폴백)
  firstPriceFromText(bodyText) {
    const m = bodyText.match(/[0-9][0-9,]*\s*원/);
    if (!m) return null;
    return parseInt(m[0].replace(/[^0-9]/g, ""), 10) || null;
  },
  // 몰별 우선 패턴 (실측 로직)
  extract(mall) {
    const bodyText = document.body ? document.body.innerText : "";
    let price = null;

    if (mall === "naver") {
      // 스마트스토어/브랜드: "상품 가격" 라벨 뒤 금액 / 카탈로그: body 첫 금액
      const m1 = bodyText.match(/상품 가격[\s\S]{0,30}?([0-9,]+)원/);
      price = m1 ? parseInt(m1[1].replace(/[^0-9]/g, ""), 10) : this.firstPriceFromText(bodyText);
    } else if (mall === "coupang") {
      // 쿠팡: "%" 다음 줄 금액 (옵션 반영) — 폴백 body 첫 금액
      const m = bodyText.match(/([0-9]{1,2})%\s*\n\s*([0-9][0-9,]*)\s*원/);
      price = m ? parseInt(m[2].replace(/[^0-9]/g, ""), 10) : this.firstPriceFromText(bodyText);
    } else if (mall === "oliveyoung") {
      // ① data-qa 할인가 ② tx_num ③ body 폴백
      const qa = document.querySelector('[data-qa-name="text-product-discount-price"]');
      if (qa) {
        const m = qa.innerText.match(/[0-9][0-9,]*/);
        if (m) price = parseInt(m[0].replace(/[^0-9]/g, ""), 10);
      }
      if (!price) {
        const tx = document.querySelector("em.tx_num");
        if (tx) {
          const m = tx.innerText.match(/[0-9][0-9,]*/);
          if (m) price = parseInt(m[0].replace(/[^0-9]/g, ""), 10);
        }
      }
      if (!price) price = this.firstPriceFromText(bodyText);
    }

    return {
      price,
      title: this.ogMeta("og:title"),
      image: this.ogMeta("og:image"),
    };
  },
};

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== "EXTRACT") return;
  const parsed = MallParser.parse(window.location.href);
  if (!parsed) {
    sendResponse({ ok: false, code: "E-EXT-URL-2001", parsed: null });
    return;
  }
  const data = Extractor.extract(parsed.mall);
  sendResponse({ ok: true, parsed, data });
});
