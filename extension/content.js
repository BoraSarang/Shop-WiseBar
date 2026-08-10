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
  extract(mall, url) {
    const bodyText = document.body ? document.body.innerText : "";
    let price = null;
    // v0.9.1: 쿠팡 품절 감지 — 블록 스코프 밖(return)에서 참조하므로 함수 레벨로 선언
    let isSoldOut = false;

    if (mall === "naver") {
      // 네이버+ 스토어/브랜드: "상품 가격" 라벨 뒤 금액 / 카탈로그: body 첫 금액
      // v0.8.7: 정가 요소(취소선/deal-before)를 clone에서 제거 후 추출 —
      //        판매가(9,000)와 정가(40,000)가 함께 렌더되어 번갈아 잡히던 진동 해결
      // v0.8.23: 스마트스토어 SPA 전환 레이스 방지 — 색상/옵션 클릭은 개별 상품
      //          페이지 이동(pushState)이라 URL이 먼저 바뀌고 DOM이 늦게 교체된다.
      //          전환 중 캡처가 옛 상품 가격을 새 product_id로 저장하는 문제
      //          (독거미 L99: 44↔46 전환 시 102,020/109,520 양방향 오염 사례).
      //          head의 JSON-LD(mpn/productID)와 URL 상품번호가 일치할 때만 수집.
      //          렌더 완료 후에는 JSON-LD offers.price(현재 상품의 정확한 판매가) 우선.
      // v0.8.24: url 인자 없이 호출되는 경로(swb-ui 추이 패널) 대비 기본값 방어
      const urlNum = ((url || window.location.href).match(/products\/(\d+)/) || [])[1] || null;
      let ldMpn = null;
      let ldPrice = null;
      const ldScript = document.querySelector('script[type="application/ld+json"]');
      if (ldScript) {
        try {
          const ld = JSON.parse(ldScript.textContent);
          if (ld.mpn || ld.productID) ldMpn = String(ld.mpn || ld.productID);
          if (ld.offers && ld.offers.price) ldPrice = Number(ld.offers.price);
        } catch {
          // JSON-LD 파싱 실패 — 검증 생략 (기존 로직 폴백)
        }
      }
      if (ldMpn && urlNum && ldMpn !== urlNum) {
        price = null; // 전환 중 — background가 캡처 스킵 (E-EXT-VALID-3001 범주)
      } else if (ldPrice && ldPrice >= 1000 && ldPrice <= 50000000) {
        price = ldPrice;
      } else {
        const clone = document.body.cloneNode(true);
        clone.querySelectorAll("del, s, strike, [class*='deal-before'], [class*='original-price']").forEach((el) => el.remove());
        const clean = clone.innerText || "";
        const m1 = clean.match(/상품 가격[\s\S]{0,30}?([0-9,]+)원/);
        price = m1 ? parseInt(m1[1].replace(/[^0-9]/g, ""), 10) : this.firstPriceFromText(clean);
      }
    } else if (mall === "coupang") {
      // 쿠팡: ① .price-container(판매가 영역) 우선 — v0.8.15 CDP 실측으로 확정
      //        (10,980/20,530/27,530원 모두 .price-container 1개 존재, 항상 정확)
      //        기존 body 첫 금액 폴백은 lazy 로드 추천 카드(글로벌특가 등)의
      //        14,900/13,800/11,900/12,510 등이 body에 끼어들어 오탐 유발 → 제거
      //        ② .total-price[data-price] 잔존값 유지 (품절이면 불신 — 스킵)
      //        v0.8.7: total-price(판매가 요소)로 한정 — 정가(예: 21,600원)도 data-price를
      //        가지는 요소가 있어 일반 [data-price] 폴백이 정가를 잡던 문제 해결
      //        v0.8.8/v0.8.9: 품절 상품은 판매가 요소가 사라지고 잔존값(14,900) 불신 — 스킵
      isSoldOut = /(일시\s?)?품절|재입고\s?알림/.test(bodyText);
      const pcEl = document.querySelector(".price-container");
      // v0.8.27: 품절이면 .price-container도 불신 — 품절 상품은 판매가 요소가 사라지고
      //          잔존값(예: 오리온 9,880원)이 남아 variant=None으로 저장되어
      //          핫딜/알림 하락 오탐(9,880 vs 20,530 52%)을 만들던 문제
      if (pcEl && !isSoldOut) {
        // v0.8.22: 할인 상품은 정가가 첫 금액으로 오는 구조 — 실제 구매가(일반할인가) 우선
        // CDP 실측: "와우할인가 44% 22,500원 12,380원 / 일반할인가 44% 22,500원 12,510원"
        //   → 기존 첫 금액 규칙이 정가(22,500)를 잡던 문제. "일반할인가" 뒤 금액이 구매가.
        //   일반 상품(라벨 없음)은 기존대로 첫 금액(오리온 "21,920원 (10g당 428원)")
        const text = pcEl.innerText;
        // "일반할인가 44% 22,500원 12,510원" — 라벨 뒤 첫 금액(22,500)도 정가이므로
        // "일반할인가" 섹션의 마지막 금액(12,510)이 실제 구매가
        const genIdx = text.lastIndexOf("일반할인가");
        if (genIdx >= 0) {
          const all = [...text.slice(genIdx).matchAll(/([0-9][0-9,]*)\s*원/g)];
          if (all.length) price = parseInt(all[all.length - 1][1].replace(/[^0-9]/g, ""), 10);
        }
        if (!price) {
          const m = text.match(/[0-9][0-9,]*\s*원/);
          if (m) price = parseInt(m[0].replace(/[^0-9]/g, ""), 10);
        }
      }
      if (!price && !isSoldOut) {
        const attrEl = document.querySelector("span.total-price[data-price], strong.total-price[data-price], .total-price[data-price]");
        if (attrEl) {
          const ap = parseInt((attrEl.getAttribute("data-price") || "").replace(/[^0-9]/g, ""), 10);
          if (ap && ap >= 1000) price = ap;
        }
      }
      // v0.8.15: body 첫 금액 폴백 제거 — 추천 카드/혜택 배너 오탐 차단
      //          price=null이면 captureProduct가 스킵 (가격 없는 페이지는 수집 안 함)
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

    const ogTitle = this.ogMeta("og:title");
    // v0.8.17: 쿠팡은 og:title이 페이지 로드 시 고정되어 수량 변경을 미반영("1개" 유지)
    //          — 실시간 상품명 요소 .product-title 우선 (CDP 실측: 수량 클릭 시
    //          "오리온 황치즈칩 쿠키, 256g, 2개" 등으로 실시간 변경됨)
    const liveTitle = mall === "coupang" ? (document.querySelector(".product-title")?.innerText || "").trim() : "";

    return {
      price,
      title: this.normalizeTitle(mall, liveTitle || ogTitle),
      image: this.ogMeta("og:image"),
      variant: this.extractVariant(mall, url),
      soldOut: isSoldOut, // v0.9.1 — 품절 상태 보고 (현재 쿠팡만 감지, 재판매 시 가격 캡처가 자동 해제)
    };
  },

  // 쿠팡 옵션/딜(itemId, vendorItemId) 추출 — 옵션/딜별 가격 분리용
  // v0.8.10: vendorItemId 추가 — 같은 productId라도 vendorItemId(딜)마다 가격이 달라
  //          itemId만 추출하면 옵션별 가격이 한 상품에 섞이는 문제 (오리온 9,880/14,900/27,530 사례)
  // v0.8.14: 캡처 시점 URL(url) 인자 사용 — 쿠팡 SPA가 로드 후 쿼리를 제거해도 variant 유지
  extractVariant(mall, url) {
    if (mall !== "coupang") return null;
    try {
      const qs = new URLSearchParams((url || window.location.href).split("?")[1] || "");
      return qs.get("itemId") || qs.get("vendorItemId") || null;
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
      const card = findCard(a);

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
  // 추천 카드(CurationItem) 이미지 URL에 goodsNo가 포함된 점을 이용.
  // v0.16.10 버그수정: 이미지 파일명은 "{A|B}{goodsNo12자리}{이미지순번2자리}ko.jpg" —
  //   예: "A00000017264304ko.jpg" → goodsNo "A000000172643" (마지막 2자리 "04" = 순번, 제거)
  //   기존 `A(\d+)...`로 14자리를 그대로 productID로 쓰면 존재하지 않는 ID로 저장되어
  //   서버 크롤러가 전부 "상품을 찾을 수 없어요"로 판정하는 치명적 버그였음 (운영 실측).
  //   → 접두사 뒤 첫 12자리만 goodsNo로 사용 (진짜 상세페이지 goodsNo = A+12자리 또는 B+12자리).
  //   v0.16.11 — B+12자리 상품(기획세트 등) 이미지 파일명은 "B..."로 시작 → 접두사 B도 허용.
  extractRelatedOliveyoung(currentProductID) {
    const items = [];
    const seen = new Set([currentProductID]);
    const cards = document.querySelectorAll('[class*="CurationItem"]');

    for (const card of cards) {
      if (items.length >= 40) break;
      const img = card.querySelector("img");
      if (!img) continue;
      const src = img.getAttribute("data-src") || img.getAttribute("src") || "";
      const m = src.match(/([AB])(\d{12,})ko\.jpg/);
      if (!m) continue;
      const productID = `${m[1]}${m[2].slice(0, 12)}`;
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
        const mall = MallParser.detectMall(window.location.href);
        const parsed = mall ? MallParser.parse(window.location.href) : null;
        const parentId = parsed ? parsed.productID : null; // 상품 페이지면 관계 저장 소스로 사용 (v0.9.6)
        const fresh = items.filter((it) => !relatedSentIds.has(it.productID));
        if (fresh.length) {
          fresh.forEach((it) => relatedSentIds.add(it.productID));
          chrome.runtime.sendMessage({ type: "RELATED_FOUND", items: fresh, parentId });
        }
        ensureWatchBadges(); // 새 카드 로드 시 찜 배지 재적용 (v0.8.5)
      }, 600); // 스크롤 멈춘 뒤 600ms — 스크롤 중 반복 전송 방지
    },
    { passive: true }
  );
}
watchScrollForRelated();

// ── 목록/검색 페이지 찜 상품 배지 (v0.8.6) ───────────────
// 검색/목록 화면에서 내 찜 상품 카드에 "★ 찜 N원" 배지 오버레이
// v0.8.6: viewport 고정(fixed) 오버레이 — 이미지가 컨테이너 위로 삐져나오거나
// overflow:hidden인 카드 구조에서도 잘리지 않고 스크롤에도 따라붙음
DebugLogger.info(`[똑바] content.js v${chrome.runtime.getManifest().version}`);
let watchedSet = new Set();
let watchedMap = new Map();
let badgeOverlays = []; // {card, el}

function findCard(a) {
  return a.closest("li, [class*='item'], [class*='product'], [class*='card'], article") || a.parentElement;
}

function positionBadges() {
  for (const { card, el } of badgeOverlays) {
    const r = card.getBoundingClientRect();
    if (!r.width && !r.height) {
      el.style.display = "none";
      continue;
    }
    el.style.display = "block";
    // 이미지 안쪽 상단 + 8px — 이미지 콘텐츠와 여백을 두고 겹치되
    // 카드 경계 밖(위 카드 위)으로는 벗어나지 않음
    const img = card.querySelector("img");
    const ir = img ? img.getBoundingClientRect() : null;
    const top = ir && ir.height ? ir.top + 4 : r.top + 12;
    el.style.left = `${r.right - 12}px`;
    el.style.top = `${top}px`;
    el.style.transform = "translateX(-100%)";
  }
}

function addBadgeToCard(card, watch) {
  if (!card || card.__swbBadged) return;
  card.__swbBadged = true;
  const el = document.createElement("div");
  el.textContent = watch && watch.last_price
    ? `★ 찜 ${Number(watch.last_price).toLocaleString()}원`
    : "★ 찜";
  el.style.cssText =
    "position:fixed;z-index:2147483646;pointer-events:none;background:#FF6B00;color:#fff;" +
    "font-size:11px;font-weight:700;padding:3px 8px;border-radius:10px;" +
    "box-shadow:0 1px 3px rgba(0,0,0,.35);white-space:nowrap;" +
    "font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif;";
  document.body.appendChild(el);
  badgeOverlays.push({ card, el });
  positionBadges();
  if (!window.__swbBadgeListenersBound) {
    window.__swbBadgeListenersBound = true;
    window.addEventListener("scroll", positionBadges, { passive: true });
    window.addEventListener("resize", positionBadges, { passive: true });
  }
}

async function ensureWatchBadges() {
  const mall = MallParser.detectMall(window.location.href);
  if (!mall) return;
  let watches;
  try {
    const res = await chrome.runtime.sendMessage({ type: "WATCHES_GET" });
    if (!res || !res.ok || !Array.isArray(res.watches)) return;
    watches = res.watches;
  } catch {
    return;
  }
  watchedSet = new Set(watches.map((w) => w.product_id));
  watchedMap = new Map(watches.map((w) => [w.product_id, w]));
  if (!watchedSet.size) return;

  if (mall.kind === "listing") {
    // 목록/검색 페이지: 찜 상품 카드마다 배지
    const anchors = document.querySelectorAll("a[href]");
    for (const a of anchors) {
      let parsed;
      try {
        parsed = MallParser.parse(a.href);
      } catch {
        continue;
      }
      if (!parsed || !watchedSet.has(parsed.productID)) continue;
      addBadgeToCard(findCard(a), watchedMap.get(parsed.productID));
    }
  } else {
    // 상품 상세 페이지 (v0.8.5): 현재 상품이 찜이면 메인 이미지에 배지
    const parsed = MallParser.parse(window.location.href);
    if (!parsed || !watchedSet.has(parsed.productID)) return;
    const imgs = [...document.querySelectorAll("img")]
      .filter((i) => {
        const r = i.getBoundingClientRect();
        return r.width >= 200 && r.height >= 200 && !!i.src;
      })
      .sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width);
    const main = imgs[0];
    if (main) addBadgeToCard(main.closest("div") || main.parentElement, watchedMap.get(parsed.productID));
  }
}

// 상품 페이지 로드/렌더 지연 대비 재시도 (lazy 이미지 로드 후 메인 이미지 확정)
function initWatchBadges() {
  setTimeout(ensureWatchBadges, 400);
  setTimeout(ensureWatchBadges, 1600);
  setTimeout(ensureWatchBadges, 4000);
}
initWatchBadges();

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
    ensureWatchBadges(); // 목록 페이지 찜 배지 (v0.8.5)
    return;
  }
  const parsed = MallParser.parse(window.location.href);
  if (!parsed) {
    sendResponse({ ok: false, code: "E-EXT-URL-2001" });
    return;
  }
  if (msg.type !== "EXTRACT") return;
  // v0.8.14: 캡처 시점 URL 전달 — 쿠팡이 SPA 로드 후 vendorItemId를 URL에서 제거해서
  //          window.location에는 없는 옵션 정보를 background가 보유한 tab.url로 추출
  const t0 = performance.now();
  const data = Extractor.extract(parsed.mall, msg.url || window.location.href);
  const dt = performance.now() - t0;
  DebugLogger.perf("[똑바] EXTRACT", dt);
  if (dt > 100) DebugLogger.warn("[똑바] 추출 100ms 초과", `${dt.toFixed(1)}ms`);
  sendResponse({ ok: true, parsed, data });
});
