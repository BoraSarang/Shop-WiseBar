// common.js — MallParser 공용 모듈 + 설정 (content script + background service worker + popup 공유)
// productID 규약: PRD 5장 (맥 메뉴바 MallParser.swift와 1:1 대응)

const SWB_CONFIG = {
  server: "https://shop-wisebar.onrender.com", // v0.7.0 — Render + Neon (클라우드)
  api: "/api/v1",
  requestTimeoutMs: 45000, // Render 무료 티어 콜드스타트(30~60s) 대기
  coldStartRetry: 2, // 콜드스타트 대기 재시도 횟수 (GET에만 적용 — 중복 저장 방지)
};

// 공용 API — 타임아웃 + 콜드스타트 자동 재시도 (v0.7.1)
async function SWB_API(path, options = {}) {
  const url = `${SWB_CONFIG.server}${SWB_CONFIG.api}${path}`;
  const method = (options.method || "GET").toUpperCase();
  const maxAttempts = method === "GET" ? SWB_CONFIG.coldStartRetry + 1 : 1;
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), SWB_CONFIG.requestTimeoutMs);
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
  // URL → { mall, productID, url } | null
  parse(urlString) {
    let url;
    try {
      url = new URL(urlString);
    } catch {
      return null;
    }
    const host = url.hostname.toLowerCase();
    const path = url.pathname;

    // 쿠팡
    if (host.includes("coupang.com")) {
      const m = path.match(/\/vp\/products\/(\d+)/);
      return m ? { mall: "coupang", productID: m[1], url: urlString } : null;
    }
    // 네이버 브랜드
    if (host.includes("brand.naver.com")) {
      const m = path.match(/^\/([a-zA-Z0-9_-]+)\/products\/(\d+)/);
      return m ? { mall: "naver", productID: `brand:${m[1]}:${m[2]}`, url: urlString } : null;
    }
    // 네이버 스마트스토어
    if (host.includes("smartstore.naver.com")) {
      const m = path.match(/^\/([a-zA-Z0-9_-]+)\/products\/(\d+)/);
      return m ? { mall: "naver", productID: `store:${m[1]}:${m[2]}`, url: urlString } : null;
    }
    // 네이버 쇼핑 카탈로그
    if (host.includes("search.shopping.naver.com")) {
      const m = path.match(/\/catalog\/(\d+)/);
      return m ? { mall: "naver", productID: `c:${m[1]}`, url: urlString } : null;
    }
    // 올리브영
    if (host.includes("oliveyoung.co.kr")) {
      const goodsNo = url.searchParams.get("goodsNo");
      return goodsNo ? { mall: "oliveyoung", productID: goodsNo, url: urlString } : null;
    }
    // 올리브영 단축 URL (oy.run)
    if (host.includes("oy.run")) {
      return { mall: "oliveyoung", productID: `oyrun:${urlString}`, url: urlString };
    }
    return null;
  },
};
