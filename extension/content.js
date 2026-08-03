// content.js — 상품 페이지 URL 파싱 + DOM 가격/제목/이미지 추출
// 기존 맥 메뉴바 MallParser/BrowserSessionFetcher 로직을 JS로 포팅 (실측 패턴 유지)
// E-EXT-URL-2001: 지원하지 않는 상품 페이지 / E-EXT-VALID-3001: 추출 실패
// MallParser/SWB_CONFIG는 common.js, UI는 swb-ui.js에서 제공

const Extractor = {
  ogMeta(prop) {
    const el = document.querySelector(`meta[property="${prop}"]`);
    return el && el.content ? el.content : null;
  },
  // body.innerText에서 "N,NNN원" 형식 숫자 중 가장 큰 값 (폴백)
  // v0.5.1: 천단위 표준 패턴만 허용 — 쿠팡 원가+할인가가 콤마로 붙어
  // "12,9009,670"처럼 오매치되던 버그 방지 ("12,9009,670" → 129009670)
  firstPriceFromText(bodyText) {
    const m = bodyText.match(/\d{1,3}(?:,\d{3})*\s*원/);
    if (!m) return null;
    const price = parseInt(m[0].replace(/[^0-9]/g, ""), 10) || null;
    if (price !== null && (price < 1000 || price > 50000000)) return null; // 오탐 범위 필터
    return price;
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
      // 쿠팡: ① data-price 속성 우선 (쿠팡이 실제 판매가에 부여하는 표준 속성 —
      //        정가/쿠폰가/사전구매 할인가가 여럿 노출되어 첫 % 매치가 진동하던 문제 해결)
      //       ② "%" 다음 줄 금액 (옵션 반영) ③ 폴백 body 첫 금액
      const attrEl = document.querySelector("span.total-price[data-price], strong.total-price[data-price], [data-price]");
      if (attrEl) {
        const ap = parseInt((attrEl.getAttribute("data-price") || "").replace(/[^0-9]/g, ""), 10);
        if (ap && ap >= 1000) price = ap;
      }
      if (!price) {
        const m = bodyText.match(/([0-9]{1,2})%\s*\n\s*([0-9][0-9,]*)\s*원/);
        price = m ? parseInt(m[2].replace(/[^0-9]/g, ""), 10) : this.firstPriceFromText(bodyText);
      }
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
      title: this.normalizeTitle(mall, this.ogMeta("og:title")),
      image: this.ogMeta("og:image"),
      variant: this.extractVariant(mall),
    };
  },

  // 쿠팡 옵션(itemId) 추출 — 옵션별 가격/제목 분리용 (다른 몰은 옵션이 URL에 없어 null)
  extractVariant(mall) {
    if (mall !== "coupang") return null;
    try {
      return new URLSearchParams(window.location.search).get("itemId") || null;
    } catch {
      return null;
    }
  },

  // 몰별 og:title 정리 (og:title은 몰이 마케팅용으로 채우는 값이라 잡음 제거)
  // 쿠팡: "상품명 - 카테고리 | 쿠팡" → "상품명"
  normalizeTitle(mall, title) {
    let t = (title || "").trim();
    if (!t) return t;
    if (mall === "coupang") {
      t = t.replace(/\s*-\s*[^|]+\s*\|\s*쿠팡\s*$/i, "").trim();
    }
    return t;
  },

  // 카드 텍스트에서 첫 유효 가격 추출 — v0.8.1: "월 N원" 할부 문구 오매치 방지
  // (쿠팡 검색 카드의 "월 28,418원"이 상품 가격보다 먼저 매치되던 문제)
  firstCardPrice(text) {
    const matches = [...text.matchAll(/(\d{1,3}(?:,\d{3})*)\s*원/g)];
    for (const m of matches) {
      const before = text.slice(Math.max(0, m.index - 6), m.index);
      if (/(월|개월)\s*$/.test(before)) continue; // 할부/개월수 문구 제외
      const price = parseInt(m[1].replace(/[^0-9]/g, ""), 10);
      if (price >= 1000 && price <= 50000000) return price;
    }
    return null;
  },

  // 연관 상품 추출 (v0.5): 페이지의 상품 링크를 카드 단위로 수집
  // 특정 섹션명("함께 비교하면 좋을 상품" 등)에 의존하지 않는 범용 방식
  // → 몰별 섹션명/구조가 바뀌어도 동작, MallParser 규약으로 productID/몰 판별
  // 반환: [{ productID, mall, url, name, image, price|null }] (가격 없으면 카탈로그 등록만)
  // v0.8.0: currentProductID null 허용 — 검색/목록 페이지(현재 상품 없음)에서 전체 카드 수집
  extractRelated(mall, currentProductID) {
    if (mall === "oliveyoung") return this.extractRelatedOliveyoung(currentProductID);
    const items = [];
    const seen = new Set();
    if (currentProductID) seen.add(currentProductID);
    const anchors = document.querySelectorAll("a[href]");

    for (const a of anchors) {
      if (items.length >= 40) break; // 서버 부하 방지 상한 (1회 캡처당 40개)
      let href;
      try {
        href = a.href;
      } catch {
        continue; // JS 핸들러 링크 등 href 조회 불가
      }
      const parsed = MallParser.parse(href);
      if (!parsed || parsed.productID === currentProductID) continue;
      if (seen.has(parsed.productID)) continue;
      seen.add(parsed.productID);

      // 카드 컨테이너: 상품 카드 구조(리스트 아이템/상품 래퍼) 근접 탐색
      let card = a.closest("li, [class*='item'], [class*='product'], [class*='card'], article");
      if (!card) card = a.parentElement;

      const img = card ? card.querySelector("img") : null;
      let image = null;
      if (img) {
        image =
          img.getAttribute("data-src") ||
          img.getAttribute("src") ||
          img.getAttribute("data-original") ||
          null;
      }
      if (image && image.startsWith("//")) image = `https:${image}`;

      // 이름: v0.8.4 — name/title/tit 클래스 후보 중 가장 긴 텍스트 선택 + 잡음 문구 제외.
      // (네이버 쇼핑 검색 카드는 스토어명/UI 문구("새 창에서 열림") 요소가 상품명보다
      // 먼저 매치됨 — 상품명이 항상 가장 길고 잡음 문구와 다르다는 점 이용)
      let name = null;
      const NOISE_NAMES = ["새 창에서 열림", "새 창으로 열기", "새창에서 열기", "새창으로 열기", "찜", "장바구니", "상품 이미지"];
      if (card) {
        let best = null;
        const scope = card.querySelector("a[href]") || card;
        const cands = scope.querySelectorAll("[class*='name'], [class*='title'], [class*='tit']");
        for (const el of cands) {
          const t = (el.textContent || "").trim();
          if (t.length < 3 || NOISE_NAMES.includes(t)) continue;
          if (!best || t.length > best.length) best = t;
        }
        if (best) name = best;
      }
      if (!name && img) {
        const alt = (img.getAttribute("alt") || "").trim();
        if (alt && !NOISE_NAMES.includes(alt)) name = alt;
      }
      if (!name && a.textContent) name = a.textContent.trim();
      if (name) name = this.normalizeTitle(parsed.mall, name.replace(/^@[^\s]+\s+/, "").slice(0, 200));

      // 가격: 카드 텍스트에서 "N,NNN원" 패턴 (가격이 없는 섹션은 null — 방문 시 캡처)
      // v0.5.1: 천단위 표준 패턴만 허용 (쿠팡 원가+할인가 붙어쓰기 오매치 방지)
      // v0.6.2: 취소선(정가/원가) 요소를 제외하고 추출 — 네이버/쿠팡 카드의 정가 159,990원 먼저 노출 문제 해결
      let price = null;
      if (card) {
        const clone = card.cloneNode(true);
        clone.querySelectorAll("s, del, strike, [style*='line-through'], [class*='del-price'], [class*='base-price']").forEach((el) => el.remove());
        price = this.firstCardPrice(clone.textContent);
      }

      items.push({
        productID: parsed.productID,
        mall: parsed.mall,
        url: href,
        name,
        image,
        price,
      });
    }
    return items;
  },

  // 올리브영 연관 상품 추출 (v0.5.2): div 클릭 SPA라 a[href] 링크가 없음.
  // 추천 카드(CurationItem) 이미지 URL에 goodsNo가 포함된 점을 이용:
  // "A00000017264304ko.jpg" → productID "A00000017264304"
  extractRelatedOliveyoung(currentProductID) {
    const items = [];
    const seen = new Set([currentProductID]);
    const cards = document.querySelectorAll('[class*="CurationItem"]');

    for (const card of cards) {
      if (items.length >= 40) break;
      const img = card.querySelector("img");
      if (!img) continue;
      const src = img.getAttribute("data-src") || img.getAttribute("src") || "";
      const m = src.match(/A(\d+)ko\.jpg/);
      if (!m) continue;
      const productID = `A${m[1]}`;
      if (seen.has(productID)) continue;
      seen.add(productID);

      let name = img.getAttribute("alt");
      if (!name && card.textContent) name = card.textContent.trim();
      if (name) name = name.slice(0, 200);

      let price = this.firstCardPrice(card.textContent);

      items.push({
        productID,
        mall: "oliveyoung",
        url: `https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=${productID}`,
        name,
        image: src.startsWith("//") ? `https:${src}` : src,
        price,
      });
    }
    return items;
  },
};

// ── 사용자 스크롤 → 새로 로드된 연관 상품 수집 (v0.5) ────
// 자동 스크롤 금지 (사용자 상품 보기 방해) — 사용자가 스크롤할 때
// lazy 로딩으로 새로 나타난 상품 카드만 background로 전송
// v0.8.0 (Phase 2): 검색/목록 페이지(product가 아닌 listing)에서도 카드 수집
let relatedSentIds = new Set(); // 이 페이지에서 이미 전송한 productID (중복 방지)
let relatedScrollTimer = null;

function collectCurrentRelated() {
  const mall = MallParser.detectMall(window.location.href);
  if (!mall) return null;
  const parsed = MallParser.parse(window.location.href);
  return Extractor.extractRelated(mall.mall, parsed ? parsed.productID : null);
}

function watchScrollForRelated() {
  window.addEventListener(
    "scroll",
    () => {
      clearTimeout(relatedScrollTimer);
      relatedScrollTimer = setTimeout(() => {
        const items = collectCurrentRelated();
        if (!items || !items.length) return;
        const fresh = items.filter((it) => !relatedSentIds.has(it.productID));
        if (!fresh.length) return;
        fresh.forEach((it) => relatedSentIds.add(it.productID));
        chrome.runtime.sendMessage({ type: "RELATED_FOUND", items: fresh });
      }, 600); // 스크롤 멈춘 뒤 600ms — 스크롤 중 반복 전송 방지
    },
    { passive: true }
  );
}
watchScrollForRelated();

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg) return;
  if (msg.type === "EXTRACT_RELATED") {
    // 초기 캡처(페이지 로드 직후) — 스크롤 없이 현재 보이는 카드만 1회
    // v0.8.0: 상품/목록 페이지 모두 지원 (currentProductID 없으면 전체 카드)
    const items = collectCurrentRelated();
    if (!items) {
      sendResponse({ ok: false, code: "E-EXT-URL-2001" });
      return;
    }
    items.forEach((it) => relatedSentIds.add(it.productID));
    sendResponse({ ok: true, items });
    return;
  }
  const parsed = MallParser.parse(window.location.href);
  if (!parsed) {
    sendResponse({ ok: false, code: "E-EXT-URL-2001" });
    return;
  }
  if (msg.type !== "EXTRACT") return;
  const data = Extractor.extract(parsed.mall);
  sendResponse({ ok: true, parsed, data });
});
