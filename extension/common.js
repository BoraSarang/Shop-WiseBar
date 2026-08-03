// common.js — MallParser 공용 모듈 + 설정 (content script + background service worker + popup 공유)
// productID 규약: PRD 5장 (맥 메뉴바 MallParser.swift와 1:1 대응)

const SWB_CONFIG = {
  server: "http://127.0.0.1:8000", // 클라우드 전환 시 여기만 수정 (옵션 페이지 추가 예정)
  api: "/api/v1",
};

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
