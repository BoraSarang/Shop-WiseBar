// content.js — 상품 페이지 URL 파싱 + DOM 가격/제목/이미지 추출
// + 오른쪽 하단 플로팅 버튼 → 가격 변동 추이 패널 (v0.3)
// 기존 맥 메뉴바 MallParser/BrowserSessionFetcher 로직을 JS로 포팅 (실측 패턴 유지)
// E-EXT-URL-2001: 지원하지 않는 상품 페이지 / E-EXT-VALID-3001: 추출 실패
// MallParser/SWB_CONFIG는 common.js에서 제공

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

// ── 플로팅 버튼 + 가격 추이 패널 (shadow DOM — 호스트 스타일 격리) ──────
const SWB_UI = (() => {
  let host = null;
  let shadow = null;
  let currentProductId = null;

  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; }
    .swb-fab {
      position: fixed; right: 20px; bottom: calc(25vh - 23px); z-index: 2147483647;
      width: 46px; height: 46px; border-radius: 50%;
      background: #2d4ae0; color: #fff; border: none; cursor: pointer;
      box-shadow: 0 4px 14px rgba(45, 74, 224, 0.45);
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .swb-fab:hover { transform: scale(1.08); box-shadow: 0 6px 18px rgba(45, 74, 224, 0.55); }
    .swb-fab svg { width: 22px; height: 22px; }
    .swb-panel {
      position: fixed; right: calc(20px + 46px + 12px); top: 75vh; transform: translateY(-50%); z-index: 2147483647;
      width: 320px; background: #fff; border-radius: 12px;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.22);
      overflow: hidden; display: flex; flex-direction: column;
      color: #1c1c1e; font-size: 13px;
    }
    .swb-panel.hidden { display: none; }
    .swb-head {
      display: flex; align-items: flex-start; gap: 8px;
      padding: 12px 14px; background: #2d4ae0; color: #fff;
    }
    .swb-title-area { flex: 1; min-width: 0; }
    .swb-title { font-weight: 600; font-size: 13px; line-height: 1.4; max-height: 2.8em; overflow: hidden; }
    .swb-brand { font-size: 11px; opacity: 0.8; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .swb-close { background: none; border: none; color: #fff; font-size: 16px; cursor: pointer; line-height: 1; padding: 2px; }
    .swb-body { padding: 12px 14px 8px; }
    .swb-price-row { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; }
    .swb-now { font-size: 20px; font-weight: 800; }
    .swb-delta { font-size: 12px; font-weight: 700; }
    .swb-delta.down { color: #2d4ae0; }
    .swb-delta.up { color: #e5484d; }
    .swb-chart-wrap { position: relative; }
    canvas.swb-chart { width: 100%; height: 140px; display: block; }
    .swb-stats { display: flex; gap: 12px; margin-top: 8px; font-size: 11px; color: #888; }
    .swb-stats b { color: #333; }
    .swb-foot { padding: 8px 14px 12px; font-size: 11px; color: #aaa; }
    .swb-loading { padding: 24px 14px; text-align: center; color: #aaa; }
    .swb-error { padding: 24px 14px; text-align: center; color: #e5484d; line-height: 1.6; }
  `;

  const FAB_SVG = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="3 17 9 11 13 15 21 7"></polyline>
      <polyline points="15 7 21 7 21 13"></polyline>
    </svg>`;

  function ensureRoot() {
    if (host) return;
    host = document.createElement("div");
    host.id = "swb-root";
    shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = CSS;
    shadow.appendChild(style);
    document.documentElement.appendChild(host);
  }

  function buildUI(parsed) {
    ensureRoot();
    if (shadow.querySelector(".swb-fab")) return;
    currentProductId = parsed.productID;

    const fab = document.createElement("button");
    fab.className = "swb-fab";
    fab.title = "똑바 — 가격 변동 추이";
    fab.innerHTML = FAB_SVG;
    fab.addEventListener("click", (e) => {
      e.stopPropagation();
      const panel = shadow.querySelector(".swb-panel");
      if (!panel) return;
      const wasHidden = panel.classList.contains("hidden");
      panel.classList.remove("hidden");
      if (wasHidden) loadTrend(parsed, panel);
      else panel.classList.add("hidden");
    });
    shadow.appendChild(fab);

    const panel = document.createElement("div");
    panel.className = "swb-panel hidden";
    panel.innerHTML = `
      <div class="swb-head">
        <div class="swb-title-area">
          <div class="swb-title">…</div>
          <div class="swb-brand"></div>
        </div>
        <button class="swb-close" title="닫기">✕</button>
      </div>
      <div class="swb-body">
        <div class="swb-price-row">
          <span class="swb-now">—</span>
          <span class="swb-delta"></span>
        </div>
        <div class="swb-chart-wrap"><canvas class="swb-chart" width="292" height="140"></canvas></div>
        <div class="swb-stats">
          <span>최저가 <b class="st-min">—</b></span>
          <span>최고가 <b class="st-max">—</b></span>
          <span>기록 <b class="st-count">—</b>건</span>
        </div>
      </div>
      <div class="swb-foot">똑바 · 가격은 상품 페이지를 볼 때마다 자동 기록됩니다</div>`;
    panel.querySelector(".swb-close").addEventListener("click", (e) => {
      e.stopPropagation();
      panel.classList.add("hidden");
    });
    shadow.appendChild(panel);
  }

  // "상품명 : 회사명" 또는 "상품명 | 플랫폼" → 분리 (og:title 실측 패턴)
  function splitTitle(raw) {
    const t = (raw || "").trim();
    const idx = Math.max(t.lastIndexOf(" : "), t.lastIndexOf(" | "));
    if (idx > 0) return { title: t.slice(0, idx).trim(), brand: t.slice(idx + 3).trim() };
    return { title: t, brand: "" };
  }

  async function loadTrend(parsed, panel) {
    const pid = encodeURIComponent(parsed.productID);
    const titleEl = panel.querySelector(".swb-title");
    const brandEl = panel.querySelector(".swb-brand");
    const nowEl = panel.querySelector(".swb-now");
    const deltaEl = panel.querySelector(".swb-delta");
    const canvas = panel.querySelector("canvas.swb-chart");
    const stMin = panel.querySelector(".st-min");
    const stMax = panel.querySelector(".st-max");
    const stCount = panel.querySelector(".st-count");
    const bodyEl = panel.querySelector(".swb-body");

    // 1) 상품명은 페이지에서 즉시 추출 (서버 대기 없음)
    const live = Extractor.extract(parsed.mall);
    const livePrice = Number(live.price) || null;
    const { title, brand } = splitTitle(live.title);
    titleEl.textContent = title || parsed.productID;
    brandEl.textContent = brand;

    // 2) 서버 이력 조회 (실패해도 현재 가격으로 그래프는 표시)
    let product = null;
    let points = [];
    let serverError = false;
    try {
      const base = `${SWB_CONFIG.server}${SWB_CONFIG.api}`;
      [product, points] = await Promise.all([
        fetch(`${base}/products/${pid}`).then((r) => (r.ok ? r.json() : null)),
        fetch(`${base}/products/${pid}/prices?limit=50`).then((r) => (r.ok ? r.json() : [])),
      ]);
    } catch {
      serverError = true;
    }

    // 3) 현재 페이지 가격을 마지막 포인트로 병합 (중복이면 유지)
    const nowPrice = livePrice || (product && product.last_price) || null;
    if (nowPrice) {
      const lastPoint = points.length ? Number(points[points.length - 1].price) : null;
      if (lastPoint !== nowPrice) {
        points = [...points, { price: nowPrice, captured_at: new Date().toISOString() }];
      }
    }

    // 4) 그래프는 무조건 표시 (이력 0건이면 현재 가격 1포인트)
    const prices = points.map((pt) => Number(pt.price));
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const pad = 8;

    drawChart(canvas, prices);

    const first = prices[0];
    nowEl.textContent = `${nowPrice.toLocaleString()}원`;
    if (points.length > 1) {
      if (nowPrice < first) {
        deltaEl.textContent = `▼ ${(first - nowPrice).toLocaleString()}원`;
        deltaEl.className = "swb-delta down";
      } else if (nowPrice > first) {
        deltaEl.textContent = `▲ ${(nowPrice - first).toLocaleString()}원`;
        deltaEl.className = "swb-delta up";
      } else {
        deltaEl.textContent = "변동 없음";
        deltaEl.className = "swb-delta";
      }
    } else {
      deltaEl.textContent = "첫 기록";
      deltaEl.className = "swb-delta";
    }
    stMin.textContent = `${min.toLocaleString()}원`;
    stMax.textContent = `${max.toLocaleString()}원`;
    stCount.textContent = String(points.length);

    if (serverError) {
      const err = document.createElement("div");
      err.className = "swb-error";
      err.textContent = "서버 이력을 불러오지 못했습니다 (E-EXT-NET-1001)";
      bodyEl.appendChild(err);
    }
  }

  function drawChart(canvas, prices) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    if (!prices.length) return;

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const pad = 8;

    if (prices.length === 1) {
      ctx.beginPath();
      ctx.arc(w / 2, h - pad, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "#2d4ae0";
      ctx.fill();
    } else {
      ctx.strokeStyle = "#2d4ae0";
      ctx.lineWidth = 2;
      ctx.beginPath();
      prices.forEach((price, i) => {
        const x = pad + (i / (prices.length - 1)) * (w - pad * 2);
        const y = h - pad - ((price - min) / range) * (h - pad * 2);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    const last = prices[prices.length - 1];
    ctx.fillStyle = "#888";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${prices[0].toLocaleString()}원`, pad, h - 3);
    ctx.textAlign = "right";
    ctx.fillText(`${last.toLocaleString()}원`, w - pad, 12);
  }

  function removeUI() {
    if (!host) return;
    host.remove();
    host = null;
    shadow = null;
    currentProductId = null;
  }

  return {
    refresh() {
      const parsed = MallParser.parse(window.location.href);
      if (parsed) buildUI(parsed);
      else removeUI();
    },
  };
})();

// 페이지 로드 시 + SPA 라우팅 대비 URL 감시 (2초 주기, location 비교만 — 비용 무시 가능)
SWB_UI.refresh();
let lastHref = location.href;
setInterval(() => {
  if (location.href !== lastHref) {
    lastHref = location.href;
    SWB_UI.refresh();
  }
}, 2000);
