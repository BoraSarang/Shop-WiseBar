// common.js — MallParser 공용 모듈 + 설정 (content script + background service worker + popup 공유)
// productID 규약: PRD 5장 (맥 메뉴바 MallParser.swift와 1:1 대응)

const SWB_CONFIG = {
  server: "https://shop-wisebar.onrender.com", // v0.7.0 — Render + Neon (클라우드)
  api: "/api/v1",
  requestTimeoutMs: 45000, // Render 무료 티어 콜드스타트(30~60s) 대기
  coldStartRetry: 2, // 콜드스타트 대기 재시도 횟수 (GET에만 적용 — 중복 저장 방지)
};

// 공용 API — 타임아웃 + 콜드스타트 자동 재시도 (v0.7.1)
// v0.11.0 (T-99k) — options.timeoutMs / options.maxAttempts 지원 (배치 POST용 90s·재시도 2회)
async function SWB_API(path, options = {}) {
  const url = `${SWB_CONFIG.server}${SWB_CONFIG.api}${path}`;
  const method = (options.method || "GET").toUpperCase();
  const timeoutMs = options.timeoutMs || SWB_CONFIG.requestTimeoutMs;
  const maxAttempts = options.maxAttempts || (method === "GET" ? SWB_CONFIG.coldStartRetry + 1 : 1);
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...options,
        signal: ctrl.signal,
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      });
      clearTimeout(timer);
      if (res.status === 404) throw Object.assign(new Error("NOT_FOUND"), { status: 404 });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.status === 204 ? null : res.json();
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      if (e && e.status === 404) throw e;
      if (attempt < maxAttempts - 1) await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw lastErr;
}

const MallParser = {
  // URL → { mall, productID, url } | null (상품 상세 페이지 전용)
  parse(urlString) {
    const d = this.detectMall(urlString);
    if (!d || d.kind !== "product") return null;
    const url = new URL(urlString);
    const host = url.hostname.toLowerCase();
    const path = url.pathname;
    const mall = d.mall;

    // 쿠팡
    if (mall === "coupang") {
      const m = path.match(/\/vp\/products\/(\d+)/);
      return m ? { mall, productID: m[1], url: urlString } : null;
    }
    // 네이버 브랜드 / 네이버+ 스토어 (접두사 규약 유지: brand:/store:)
    // v0.11.0 — 네이버+ 스토어 주소 변경 반영: smartstore + shopping 모두 지원
    if (host.includes("brand.naver.com")) {
      const m = path.match(/^\/([a-zA-Z0-9_-]+)\/products\/(\d+)/);
      return m ? { mall, productID: `brand:${m[1]}:${m[2]}`, url: urlString } : null;
    }
    if (host.includes("smartstore.naver.com") || host.includes("shopping.naver.com")) {
      const m = path.match(/^\/([a-zA-Z0-9_-]+)\/products\/(\d+)/);
      return m ? { mall, productID: `store:${m[1]}:${m[2]}`, url: urlString } : null;
    }
    // 네이버 쇼핑 카탈로그
    if (host.includes("search.shopping.naver.com")) {
      const m = path.match(/\/catalog\/(\d+)/);
      return m ? { mall, productID: `c:${m[1]}`, url: urlString } : null;
    }
    // 올리브영
    if (mall === "oliveyoung") {
      const goodsNo = url.searchParams.get("goodsNo");
      return goodsNo ? { mall, productID: goodsNo, url: urlString } : null;
    }
    // 올리브영 단축 URL (oy.run)
    if (host.includes("oy.run")) {
      return { mall, productID: `oyrun:${urlString}`, url: urlString };
    }
    return null;
  },

  // URL → { mall, kind: "product"|"listing" } | null — 상품 페이지가 아니어도 몰 판별
  // Phase 2 (v0.8.0): 검색/목록 페이지에서도 상품 카드를 수집하기 위해 추가
  detectMall(urlString) {
    let url;
    try {
      url = new URL(urlString);
    } catch {
      return null;
    }
    const host = url.hostname.toLowerCase();
    const path = url.pathname;

    if (host.includes("coupang.com")) {
      return { mall: "coupang", kind: /\/vp\/products\/\d+/.test(path) ? "product" : "listing" };
    }
    if (host.includes("search.shopping.naver.com")) {
      return { mall: "naver", kind: /\/catalog\/\d+/.test(path) ? "product" : "listing" };
    }
    if (host.includes("brand.naver.com") || host.includes("smartstore.naver.com") || host.includes("shopping.naver.com")) {
      return { mall: "naver", kind: /\/[^/]+\/products\/\d+/.test(path) ? "product" : "listing" };
    }
    if (host.includes("oliveyoung.co.kr")) {
      return { mall: "oliveyoung", kind: url.searchParams.get("goodsNo") ? "product" : "listing" };
    }
    if (host.includes("oy.run")) {
      return { mall: "oliveyoung", kind: "product" };
    }
    return null;
  },
};
