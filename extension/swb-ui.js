// swb-ui.js — 똑바 플로팅 버튼 + 툴팁 + 180° 펼침 메뉴 + 패널 (shadow DOM 격리)
// 메뉴: 가격 추이 / 찜 목록 관리 / 설정 — v0.3.2
// E-EXT-NET-1001: 서버 연결 실패 / E-EXT-VALID-3001: 추출 실패

const SWB_UI = (() => {
  let host = null;
  let shadow = null;
  let currentParsed = null;
  let menuOpen = false;
  let currentWatched = false;
  let menuWatchBtn = null;
  let rangeDays = 7;
  let pointsCache = [];
  let nowPriceCache = null;
  let serverStatsCache = null;

  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; }
    .swb-fab {
      position: fixed; right: 20px; bottom: calc(25vh - 23px); z-index: 2147483647;
      width: 46px; height: 46px; border-radius: 50%;
      background: #2d4ae0; color: #fff; border: none; cursor: pointer;
      box-shadow: 0 4px 14px rgba(45, 74, 224, 0.45);
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .swb-fab:hover { box-shadow: 0 6px 18px rgba(45, 74, 224, 0.55); }
    .swb-fab.open { transform: rotate(180deg) scale(1.06); }
    .swb-fab svg { width: 22px; height: 22px; }
    .swb-tooltip {
      position: fixed; z-index: 2147483647; pointer-events: none;
      background: #fff; color: #2d4ae0; font-size: 12px; font-weight: 700;
      padding: 4px 10px; border-radius: 8px; box-shadow: 0 4px 14px rgba(0,0,0,0.18);
      opacity: 0; transform: translateX(-6px); transition: opacity 0.15s ease, transform 0.15s ease;
      white-space: nowrap;
    }
    .swb-tooltip.show { opacity: 1; transform: translateX(0); }
    .swb-menu {
      position: fixed; z-index: 2147483647;
      right: calc(20px + 46px + 14px); bottom: calc(25vh - 23px);
      display: flex; flex-direction: column-reverse; align-items: flex-end; gap: 10px;
      opacity: 0; pointer-events: none; transform: translateX(-8px);
      transition: opacity 0.18s ease, transform 0.18s ease;
    }
    .swb-menu.open { opacity: 1; pointer-events: auto; transform: translateX(0); }
    .swb-mi {
      position: relative; display: flex; align-items: center; justify-content: center;
      width: 40px; height: 40px; border-radius: 50%;
      background: #fff; color: #2d4ae0; border: none; cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.18);
      transition: transform 0.15s ease, background 0.15s ease, color 0.15s ease;
    }
    .swb-mibadge { position: absolute; top: 0; right: 0; min-width: 15px; height: 15px; border-radius: 8px; background: #e5484d; color: #fff; font-size: 9px; font-weight: 800; align-items: center; justify-content: center; padding: 0 3px; }
    .swb-mi:hover { transform: translateX(-4px); background: #2d4ae0; color: #fff; }
    .swb-mi.active { background: #e5484d; color: #fff; }
    .swb-mi.active:hover { background: #e5484d; }
    .swb-mi svg { width: 18px; height: 18px; }
    .swb-mi-label {
      position: absolute; right: calc(100% + 8px); white-space: nowrap;
      font-size: 11px; font-weight: 600; color: #333;
      background: #fff; padding: 3px 8px; border-radius: 6px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.14); opacity: 0; transform: translateX(4px);
      transition: opacity 0.12s ease, transform 0.12s ease; pointer-events: none;
    }
    .swb-mi:hover .swb-mi-label { opacity: 1; transform: translateX(0); }
    .swb-panel {
      position: fixed; right: calc(20px + 46px + 12px); top: 75vh; z-index: 2147483647;
      width: 320px; max-height: calc(100vh - 24px);
      background: #fff; border-radius: 12px;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.22);
      overflow-y: auto; display: flex; flex-direction: column;
      color: #1c1c1e; font-size: 13px;
    }
    .swb-panel.hidden { display: none; }
    .swb-head {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 14px; background: #2d4ae0; color: #fff;
    }
    .swb-head-icon { display: flex; align-items: center; }
    .swb-head-icon svg { width: 16px; height: 16px; }
    .swb-head-back { background: none; border: none; color: #fff; font-size: 15px; cursor: pointer; padding: 0 2px; line-height: 1; }
    .swb-head-title { flex: 1; font-weight: 600; font-size: 13px; }
    .swb-close { background: none; border: none; color: #fff; font-size: 16px; cursor: pointer; line-height: 1; padding: 2px; }
    .swb-view { display: none; }
    .swb-view.active { display: block; }
    .swb-body { padding: 12px 14px 8px; }
    .swb-title-area { padding: 12px 14px 0; }
    .swb-title { font-weight: 600; font-size: 13px; line-height: 1.4; max-height: 2.8em; overflow: hidden; }
    .swb-brand { font-size: 11px; opacity: 0.8; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .swb-price-row { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; }
    .swb-now { font-size: 20px; font-weight: 800; }
    .swb-delta { font-size: 12px; font-weight: 700; }
    .swb-delta.down { color: #2d4ae0; }
    .swb-delta.up { color: #e5484d; }
    .swb-range { display: flex; gap: 4px; margin-bottom: 10px; }
    .swb-range-btn {
      flex: 1; padding: 4px 0; font-size: 11px; font-weight: 600;
      background: #f2f4ff; color: #2d4ae0; border: none; border-radius: 8px; cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease;
    }
    .swb-range-btn.active { background: #2d4ae0; color: #fff; }
    .swb-watch {
      position: relative;
      margin-left: auto; align-self: center;
      background: none; border: none; cursor: pointer;
      color: #ccc; padding: 4px;
      transition: color 0.15s ease, transform 0.15s ease;
    }
    .swb-watch:hover { transform: scale(1.12); color: #e5484d; }
    .swb-watch.active { color: #e5484d; }
    .swb-watch.active svg { fill: currentColor; }
    .swb-watch svg { width: 20px; height: 20px; }
    .swb-watch-label {
      position: absolute; right: calc(100% + 8px); top: 50%;
      transform: translate(4px, -50%);
      white-space: nowrap; font-size: 11px; font-weight: 600; color: #333;
      background: #fff; padding: 3px 8px; border-radius: 6px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.14); opacity: 0;
      transition: opacity 0.12s ease, transform 0.12s ease; pointer-events: none;
    }
    .swb-watch:hover .swb-watch-label { opacity: 1; transform: translate(0, -50%); }
    .swb-chart-wrap { position: relative; }
    canvas.swb-chart { width: 100%; height: 140px; display: block; }
    .swb-xaxis { display: flex; justify-content: space-between; font-size: 10px; color: #aaa; margin-top: 2px; }
    .swb-stats { display: flex; gap: 12px; margin-top: 8px; font-size: 11px; color: #888; }
    .swb-stats b { color: #333; }
    .swb-deal {
      display: inline-block; margin: 8px 0 0; padding: 3px 8px; border-radius: 8px;
      font-size: 11px; font-weight: 800; color: #fff; background: #2d4ae0;
    }
    .swb-deal.hot { background: #e5484d; }
    .swb-deal.warn { background: #8a8f98; }
    .swb-deal.hidden { display: none; }
    .swb-foot { padding: 8px 14px 12px; font-size: 11px; color: #aaa; }
    .swb-list { padding: 6px 14px 12px; max-height: 340px; overflow-y: auto; }
    .swb-list-head { display: flex; align-items: center; justify-content: space-between; padding: 8px 14px 0; }
    .swb-list-count { font-size: 12px; font-weight: 700; color: #444; }
    .swb-mall-filter { display: flex; gap: 4px; }
    .swb-mf-btn { font-size: 10px; font-weight: 700; color: #666; background: #f1f3f5; border: none; border-radius: 9px; padding: 2px 7px; cursor: pointer; }
    .swb-mf-btn.active { background: #2d4ae0; color: #fff; }
    .swb-deals-head { padding: 8px 14px 0; display: flex; justify-content: flex-end; }
    .swb-deals-days { display: flex; gap: 4px; }
    .swb-deal-btn { font-size: 10px; font-weight: 700; color: #666; background: #f1f3f5; border: none; border-radius: 9px; padding: 2px 7px; cursor: pointer; }
    .swb-deal-btn.active { background: #2d4ae0; color: #fff; }
    .swb-deals { padding: 6px 14px 12px; max-height: 380px; overflow-y: auto; }
    .swb-deal-li { display: flex; align-items: center; gap: 8px; padding: 7px 8px; border-radius: 8px; background: #f4f7ff; margin-bottom: 6px; cursor: pointer; }
    .swb-deal-li:hover { background: #e8eeff; }
    .swb-deal-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .swb-deal-name { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .swb-deal-price { font-size: 12px; font-weight: 700; }
    .swb-deal-before { font-size: 10px; font-weight: 400; color: #999; text-decoration: line-through; margin-left: 4px; }
    .swb-deal-pct { font-size: 11px; font-weight: 800; color: #fff; background: #e5484d; padding: 2px 6px; border-radius: 5px; flex-shrink: 0; }
    .swb-alerts { padding: 6px 14px 12px; max-height: 380px; overflow-y: auto; }
    .swb-alert-li { display: flex; align-items: center; gap: 8px; padding: 7px 8px; border-radius: 8px; background: #fff8f6; margin-bottom: 6px; cursor: pointer; }
    .swb-alert-li:hover { background: #fdeeea; }
    .swb-alert-badge { font-size: 10px; font-weight: 800; color: #fff; background: #2d4ae0; padding: 2px 6px; border-radius: 5px; flex-shrink: 0; }
    .swb-alert-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .swb-alert-name { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .swb-alert-meta { font-size: 11px; color: #e5484d; font-weight: 600; }
    .swb-li {
      display: flex; align-items: center; gap: 10px; width: 100%;
      padding: 10px 0; border: none; background: none; cursor: pointer;
      border-bottom: 1px solid #f0f0f0; text-align: left;
    }
    .swb-li:last-child { border-bottom: none; }
    .swb-li-thumb {
      position: relative; width: 44px; height: 44px; border-radius: 10px; flex-shrink: 0;
      background: #f2f4ff center/cover no-repeat;
      display: flex; align-items: center; justify-content: center;
      font-size: 15px; font-weight: 800; color: #2d4ae0;
    }
    .swb-li-badge {
      position: absolute; right: 2px; bottom: 2px;
      width: 16px; height: 16px; border-radius: 50%;
      background: #fff; display: flex; align-items: center; justify-content: center;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    }
    .swb-li-badge img { width: 11px; height: 11px; border-radius: 3px; }
    .swb-li-badge.b-fallback {
      font-size: 8px; font-weight: 800; color: #fff; font-style: normal;
    }
    .swb-li-badge.b-fallback.b-naver { background: #03c75a; }
    .swb-li-badge.b-fallback.b-coupang { background: #0074e9; }
    .swb-li-badge.b-fallback.b-oliveyoung { background: #56a99c; }
    .swb-li-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .swb-li-name { font-size: 12px; color: #333; line-height: 1.35; max-height: 2.6em; overflow: hidden; }
    .swb-li-price { font-size: 12px; font-weight: 700; color: #2d4ae0; }
    .swb-li-check { font-size: 10px; color: #aaa; }
    .swb-li-check.stale {
      align-self: flex-start; color: #e5484d; background: #fff3f2;
      border-radius: 8px; padding: 1px 8px; font-weight: 700;
    }
    .swb-li-del { background: none; border: none; color: #ccc; font-size: 14px; cursor: pointer; padding: 4px; }
    .swb-li-del:hover { color: #e5484d; }
    .swb-confirm {
      position: fixed; inset: 0; z-index: 2147483647;
      background: rgba(0, 0, 0, 0.35);
      display: flex; align-items: center; justify-content: center;
    }
    .swb-confirm-box {
      width: 260px; background: #fff; border-radius: 12px;
      padding: 18px 16px 12px; box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
    }
    .swb-confirm-msg { font-size: 13px; color: #333; line-height: 1.5; margin-bottom: 14px; word-break: break-all; }
    .swb-confirm-actions { display: flex; gap: 8px; }
    .swb-confirm-actions button {
      flex: 1; padding: 7px 0; border: none; border-radius: 8px;
      font-size: 12px; font-weight: 700; cursor: pointer;
    }
    .swb-confirm-no { background: #f2f4ff; color: #2d4ae0; }
    .swb-confirm-yes { background: #e5484d; color: #fff; }
    .swb-loading { padding: 24px 14px; text-align: center; color: #aaa; }
    .swb-spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid #dfe3f8; border-top-color: #2d4ae0; border-radius: 50%; vertical-align: -2px; margin-right: 6px; animation: swb-spin .8s linear infinite; }
    @keyframes swb-spin { to { transform: rotate(360deg); } }
    .swb-error { padding: 24px 14px; text-align: center; color: #e5484d; line-height: 1.6; }
    .swb-empty { padding: 24px 14px; text-align: center; color: #aaa; }
  `;

  const ICON = {
    fab: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 7"></polyline><polyline points="15 7 21 7 21 13"></polyline></svg>`,
    trend: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>`,
    watch: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`,
    settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
    info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
    deal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11h18l-2 8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2l-2-8z"></path><path d="M12 2a4 4 0 0 1 4 4v5h-8V6a4 4 0 0 1 4-4z"></path></svg>`,
    bell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`,
  };

  function ensureRoot() {
    if (host) return;
    host = document.createElement("div");
    host.id = "swb-root";
    shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = CSS;
    shadow.appendChild(style);
    document.documentElement.appendChild(host);
    window.addEventListener("resize", () => positionPanel());
  }

  // "상품명 : 회사명" 또는 "상품명 | 플랫폼" → 분리 (og:title 실측 패턴)
  function splitTitle(raw) {
    const t = (raw || "").trim();
    const idx = Math.max(t.lastIndexOf(" : "), t.lastIndexOf(" | "));
    if (idx > 0) return { title: t.slice(0, idx).trim(), brand: t.slice(idx + 3).trim() };
    return { title: t, brand: "" };
  }

  function buildUI(parsed) {
    ensureRoot();
    if (shadow.querySelector(".swb-fab")) return;
    currentParsed = parsed;

    const fab = document.createElement("button");
    fab.className = "swb-fab";
    fab.innerHTML = ICON.fab;
    fab.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleMenu();
    });
    fab.addEventListener("mouseenter", showTooltip);
    fab.addEventListener("mouseleave", hideTooltip);
    shadow.appendChild(fab);

    const tooltip = document.createElement("div");
    tooltip.className = "swb-tooltip";
    tooltip.textContent = "똑바";
    shadow.appendChild(tooltip);

    const menu = document.createElement("div");
    menu.className = "swb-menu";
    shadow.appendChild(menu);

    const panel = document.createElement("div");
    panel.className = "swb-panel hidden";
    new ResizeObserver(() => positionPanel()).observe(panel);
    panel.innerHTML = `
      <div class="swb-head">
        <span class="swb-head-icon">${ICON.fab}</span>
        <button class="swb-head-back">‹</button>
        <div class="swb-head-title">가격 변동 추이</div>
        <button class="swb-close" title="닫기">✕</button>
      </div>
      <div class="swb-view swb-view-trend">
        <div class="swb-title-area">
          <div class="swb-title">…</div>
          <div class="swb-brand"></div>
        </div>
        <div class="swb-body">
          <div class="swb-range">
            <button class="swb-range-btn active" data-days="7">7일</button>
            <button class="swb-range-btn" data-days="14">2주</button>
            <button class="swb-range-btn" data-days="30">1달</button>
          </div>
          <div class="swb-price-row">
            <span class="swb-now">—</span>
            <span class="swb-delta"></span>
            <button class="swb-watch" title="찜 하기">${ICON.watch}<span class="swb-watch-label">찜 하기</span></button>
          </div>
          <div class="swb-chart-wrap"><canvas class="swb-chart" width="292" height="140"></canvas></div>
          <div class="swb-xaxis"><span class="x-start"></span><span class="x-end"></span></div>
          <div class="swb-stats">
            <span>최저가 <b class="st-min">—</b></span>
            <span>최고가 <b class="st-max">—</b></span>
            <span>기록 <b class="st-count">—</b>일</span>
          </div>
          <span class="swb-deal hidden"></span>
        </div>
        <div class="swb-foot">똑바 · 최저가를 놓치지 마세요</div>
      </div>
      <div class="swb-view swb-view-list">
        <div class="swb-list-head">
          <span class="swb-list-count">찜 목록</span>
          <div class="swb-mall-filter">
            <button data-mall="all" class="swb-mf-btn active">전체</button>
            <button data-mall="naver" class="swb-mf-btn">네이버</button>
            <button data-mall="coupang" class="swb-mf-btn">쿠팡</button>
            <button data-mall="oliveyoung" class="swb-mf-btn">올리브영</button>
          </div>
        </div>
        <div class="swb-list"></div>
      </div>
      <div class="swb-view swb-view-deals">
        <div class="swb-deals-head">
          <div class="swb-deals-days">
            <button data-days="1" class="swb-deal-btn">1일</button>
            <button data-days="7" class="swb-deal-btn active">7일</button>
            <button data-days="30" class="swb-deal-btn">30일</button>
          </div>
        </div>
        <div class="swb-deals"></div>
      </div>
      <div class="swb-view swb-view-alerts">
        <div class="swb-alerts"></div>
      </div>`;
    panel.querySelector(".swb-close").addEventListener("click", (e) => {
      e.stopPropagation();
      closeAll();
    });
    panel.querySelector(".swb-head-back").addEventListener("click", (e) => {
      e.stopPropagation();
      showView("trend");
    });
    panel.querySelector(".swb-watch").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleWatch();
    });
    panel.querySelectorAll(".swb-range-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        setRange(Number(btn.dataset.days));
      });
    });
    panel.querySelectorAll(".swb-mf-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        watchMallFilter = btn.dataset.mall;
        panel.querySelectorAll(".swb-mf-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        renderWatchList();
      });
    });
    panel.querySelectorAll(".swb-deal-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        dealDaysView = Number(btn.dataset.days);
        panel.querySelectorAll(".swb-deal-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        loadDealsView();
      });
    });
    shadow.appendChild(panel);

    buildMenu(menu);
  }

  function buildMenu(menu) {
    const items = [
      { key: "trend", label: "가격 추이", icon: ICON.trend },
      { key: "deals", label: "오늘의 핫딜", icon: ICON.deal },
      { key: "list", label: "찜 목록", icon: ICON.watch },
      { key: "alerts", label: "알림", icon: ICON.bell },
      { key: "set", label: "설정", icon: ICON.settings },
      { key: "help", label: "사용법", icon: ICON.info },
    ];
    items.forEach((it) => {
      const btn = document.createElement("button");
      btn.className = "swb-mi";
      btn.dataset.key = it.key;
      btn.innerHTML = `${it.icon}<span class="swb-mi-label">${it.label}</span>`;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        onMenuItem(it.key);
      });
      if (it.key === "list") menuWatchBtn = btn;
      if (it.key === "alerts") {
        btn.classList.add("has-badge");
        alertBadgeEl = btn.appendChild(document.createElement("span"));
        alertBadgeEl.className = "swb-mibadge";
        alertBadgeEl.style.display = "none";
      }
      menu.appendChild(btn);
    });
  }

  function toggleMenu() {
    const panel = shadow.querySelector(".swb-panel");
    const panelOpen = panel && !panel.classList.contains("hidden");
    if (menuOpen || panelOpen) {
      closeAll(); // 열려 있는 하위 팝업(메뉴/패널)은 전부 닫기
      return;
    }
    menuOpen = true;
    const fab = shadow.querySelector(".swb-fab");
    const menu = shadow.querySelector(".swb-menu");
    fab.classList.add("open");
    menu.classList.add("open");
    hideTooltip();
    refreshWatchState();
  }

  function showTooltip() {
    const fab = shadow.querySelector(".swb-fab");
    const tip = shadow.querySelector(".swb-tooltip");
    if (!fab || !tip || menuOpen) return;
    const r = fab.getBoundingClientRect();
    tip.style.right = `${window.innerWidth - r.left + 10}px`;
    tip.style.top = `${r.top + r.height / 2}px`;
    tip.style.transform = "translateY(-50%)";
    requestAnimationFrame(() => tip.classList.add("show"));
  }
  function hideTooltip() {
    const tip = shadow.querySelector(".swb-tooltip");
    if (tip) tip.classList.remove("show");
  }

  // 패널 위치: 기본은 플로팅 버튼 왼쪽 중앙(화면 75vh), 하단이 넘치면 위로 이동
  function positionPanel() {
    const panel = shadow.querySelector(".swb-panel");
    if (!panel || panel.classList.contains("hidden")) return;
    const vh = window.innerHeight;
    const h = panel.getBoundingClientRect().height;
    const desired = vh * 0.75 - h / 2; // 아이콘 중앙 정렬
    const maxTop = vh - h - 12;        // 브라우저 하단 12px 여유
    panel.style.top = Math.max(12, Math.min(desired, maxTop)) + "px";
  }

  function showPanel() {
    const panel = shadow.querySelector(".swb-panel");
    panel.classList.remove("hidden");
    positionPanel();
  }
  function closePanel() {
    const panel = shadow.querySelector(".swb-panel");
    if (panel) panel.classList.add("hidden");
  }
  function closeAll() {
    menuOpen = false;
    const fab = shadow.querySelector(".swb-fab");
    const menu = shadow.querySelector(".swb-menu");
    if (fab) fab.classList.remove("open");
    if (menu) menu.classList.remove("open");
    closePanel();
  }

  function showView(name) {
    const panel = shadow.querySelector(".swb-panel");
    panel.querySelectorAll(".swb-view").forEach((v) => v.classList.remove("active"));
    panel.querySelector(`.swb-view-${name}`).classList.add("active");
    const titles = { trend: "가격 변동 추이", deals: "오늘의 핫딜", list: "찜 목록 관리", alerts: "알림 내역", set: "설정" };
    panel.querySelector(".swb-head-title").textContent = titles[name] || "";
    const back = panel.querySelector(".swb-head-back");
    back.style.display = name === "trend" ? "none" : "block";
    panel.classList.remove("hidden");
    positionPanel();
  }

  async function onMenuItem(key) {
    if (key === "set") {
      closeAll();
      chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" }); // openOptionsPage는 content script에서 직접 호출 불가 — background 경유
      return;
    }
    if (key === "help") {
      closeAll();
      chrome.runtime.sendMessage({ type: "OPEN_TAB", url: chrome.runtime.getURL("onboarding.html") });
      return;
    }
    toggleMenu();
    showPanel();
    if (key === "trend") {
      showView("trend");
      loadTrend();
    } else if (key === "deals") {
      showView("deals");
      loadDealsView();
    } else if (key === "alerts") {
      showView("alerts");
      loadAlertsView();
    } else {
      showView("list");
      loadWatchList();
    }
  }

  function updateWatchBtn() {
    const btn = shadow.querySelector(".swb-watch");
    if (!btn) return;
    const text = currentWatched ? "찜 해제" : "찜 하기";
    btn.classList.toggle("active", currentWatched);
    btn.title = text;
    const label = btn.querySelector(".swb-watch-label");
    if (label) label.textContent = text;
    if (menuWatchBtn) menuWatchBtn.classList.toggle("active", currentWatched);
  }

  async function refreshWatchState() {
    if (!currentParsed) return;
    try {
      const deviceId = await getDeviceId();
      if (!deviceId) return;
      const p = await SWB_API(`/products/${encodeURIComponent(currentParsed.productID)}?device_id=${encodeURIComponent(deviceId)}`);
      currentWatched = !!p.is_watched;
      updateWatchBtn();
    } catch {
      // E-EXT-NET-1001 — 메뉴 아이콘은 기존 상태 유지
    }
  }

  async function toggleWatch() {
    const deviceId = await getDeviceId();
    if (!deviceId || !currentParsed) {
      const btn = shadow.querySelector(".swb-watch");
      if (btn) btn.title = "기기 등록이 필요합니다 (설정 참조)";
      setTimeout(updateWatchBtn, 2000);
      return;
    }
    const pid = encodeURIComponent(currentParsed.productID);
    try {
      if (currentWatched) {
        await SWB_API(`/devices/${encodeURIComponent(deviceId)}/watches/${pid}`, { method: "DELETE" });
        currentWatched = false;
      } else {
        await SWB_API(`/devices/${encodeURIComponent(deviceId)}/watches/${pid}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        currentWatched = true;
      }
      updateWatchBtn();
      chrome.runtime.sendMessage({ type: "WATCHES_INVALIDATE" }).catch(() => {}); // 목록 배지 캐시 무효화 (v0.8.5)
    } catch {
      const btn = shadow.querySelector(".swb-watch");
      if (btn) btn.title = "서버 연결 실패 (E-EXT-NET-1001)";
      setTimeout(updateWatchBtn, 2000);
    }
  }

  async function loadTrend() {
    const parsed = currentParsed;
    const panel = shadow.querySelector(".swb-panel");
    const pid = encodeURIComponent(parsed.productID);
    const titleEl = panel.querySelector(".swb-title");
    const brandEl = panel.querySelector(".swb-brand");

    // 1) 상품명/현재 가격은 페이지에서 즉시 추출 (서버 대기 없음)
    // v0.8.24: 현재 URL 명시 전달 — extract가 url 인자 없이 호출되면
    //          v0.8.23의 JSON-LD 검증(url.match)에서 크래시 → 추이 패널 로딩 중단
    const live = Extractor.extract(parsed.mall, location.href);
    nowPriceCache = Number(live.price) || null;
    const { title, brand } = splitTitle(live.title);
    titleEl.textContent = title || parsed.productID;
    brandEl.textContent = brand;

    // v0.8.19: 쿠팡 수량 옵션(variant)별 조회 — 추이 그래프/통계가 현재 탭의
    //          수량(1개/2개/3개) 가격만 그리도록 (variant 혼합으로 인한 요동 방지)
    const liveVariant = live.variant || null;
    const variantQS = liveVariant ? `&variant=${encodeURIComponent(liveVariant)}` : "";

    // 2) 서버 이력 조회 → 캐시 (실패해도 현재 가격으로 그래프는 표시)
    // 로딩 인디케이터 — 서버 조회 동안 차트 자리 표시
    const chartWrap = panel.querySelector(".swb-chart-wrap");
    chartWrap.innerHTML = `<div class="swb-loading"><span class="swb-spinner"></span>가격 이력 불러오는 중…</div>`;
    // v0.8.25: 로딩 중 이전 상품의 가격/통계/기간이 남아 보이는 것 방지 —
    //          로딩 완료 후 값이 바뀌는 것과 이전 값이 먼저 보이는 것이 애매하므로
    //          서버 조회 시작 시 표시 요소 전부 초기화
    panel.querySelector(".swb-now").textContent = "—";
    panel.querySelector(".swb-delta").textContent = "";
    panel.querySelector(".st-min").textContent = "";
    panel.querySelector(".st-max").textContent = "";
    panel.querySelector(".st-count").textContent = "";
    panel.querySelector(".x-start").textContent = "";
    panel.querySelector(".x-end").textContent = "";
    let serverError = false;
    currentWatched = false;
    updateWatchBtn();
    try {
      const deviceId = await getDeviceId();
      const [product, points] = await Promise.all([
        SWB_API(`/products/${pid}${deviceId ? `?device_id=${encodeURIComponent(deviceId)}${variantQS}` : ""}`).catch(() => null),
        SWB_API(`/products/${pid}/prices?limit=200${variantQS}`).catch(() => []),
      ]);
      pointsCache = points || [];
      if (product) {
        if (!nowPriceCache && product.last_price) nowPriceCache = Number(product.last_price);
        if (product.is_watched) currentWatched = true;
        serverStatsCache = {
          min_price: product.min_price,
          avg_price: product.avg_price,
          price_count: product.price_count,
          watch_count: product.watch_count,
        };
      }
    } catch {
      serverError = true;
    }
    updateWatchBtn();
    renderTrend(serverError);
  }

  // 일별 시리즈: 기간(일) 동안 날짜별 가격, 결측일은 직전 가격 유지,
  // 첫 기록 이전 날짜는 첫 기록 가격으로 채움 (새 상품 → 7일 그래프가 평평하게 시작)
  function dailySeries(points, days, nowPrice) {
    const today = new Date();
    const keyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const keys = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      keys.push(keyOf(d));
    }
    const byDay = {};
    (points || []).forEach((pt) => {
      const d = new Date(pt.captured_at);
      if (!isNaN(d)) byDay[keyOf(d)] = Number(pt.price);
    });
    if (nowPrice) byDay[keyOf(today)] = nowPrice; // 오늘은 페이지 현재 가격 우선

    const raw = keys.map((k) => (k in byDay ? byDay[k] : null));
    let last = null;
    const fwd = raw.map((v) => (v !== null ? (last = v) : last)); // 중간 결측 = 직전 가격 유지
    let first = null;
    for (let i = fwd.length - 1; i >= 0; i--) {
      if (fwd[i] !== null) {
        first = fwd[i];
        break;
      }
    }
    return { series: fwd.map((v) => (v === null ? first : v)), recordDays: keys.filter((k) => k in byDay).length };
  }

  function setRange(days) {
    rangeDays = days;
    shadow.querySelectorAll(".swb-range-btn").forEach((b) => {
      b.classList.toggle("active", Number(b.dataset.days) === days);
    });
    renderTrend(false);
  }

  function renderTrend(serverError) {
    const panel = shadow.querySelector(".swb-panel");
    const chartWrap = panel.querySelector(".swb-chart-wrap");
    if (!chartWrap.querySelector("canvas")) {
      chartWrap.innerHTML = `<canvas class="swb-chart" width="292" height="140"></canvas>`;
    }
    const nowEl = panel.querySelector(".swb-now");
    const deltaEl = panel.querySelector(".swb-delta");
    const canvas = panel.querySelector("canvas.swb-chart");
    const stMin = panel.querySelector(".st-min");
    const stMax = panel.querySelector(".st-max");
    const stCount = panel.querySelector(".st-count");
    const xStart = panel.querySelector(".x-start");
    const xEnd = panel.querySelector(".x-end");
    const bodyEl = panel.querySelector(".swb-view-trend .swb-body");

    const { series, recordDays } = dailySeries(pointsCache, rangeDays, nowPriceCache);
    drawChart(canvas, series);

    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - (rangeDays - 1));
    const fmt = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
    xStart.textContent = `${fmt(start)} ~`;
    xEnd.textContent = `오늘 ${fmt(today)}`;

    const nowPrice = nowPriceCache;
    nowEl.textContent = nowPrice != null ? `${nowPrice.toLocaleString()}원` : "—";
    const first = series[0];
    if (recordDays <= 1) {
      deltaEl.textContent = "첫 기록";
      deltaEl.className = "swb-delta";
    } else if (nowPrice != null && first != null && nowPrice < first) {
      deltaEl.textContent = `▼ ${(first - nowPrice).toLocaleString()}원`;
      deltaEl.className = "swb-delta down";
    } else if (nowPrice != null && first != null && nowPrice > first) {
      deltaEl.textContent = `▲ ${(nowPrice - first).toLocaleString()}원`;
      deltaEl.className = "swb-delta up";
    } else {
      deltaEl.textContent = "변동 없음";
      deltaEl.className = "swb-delta";
    }

    const valid = series.filter((v) => v != null);
    if (valid.length) {
      stMin.textContent = `${Math.min(...valid).toLocaleString()}원`;
      stMax.textContent = `${Math.max(...valid).toLocaleString()}원`;
    } else {
      stMin.textContent = "—";
      stMax.textContent = "—";
    }
    stCount.textContent = String(recordDays);

    renderDealBadge(panel, nowPrice);

    bodyEl.querySelectorAll(".swb-error").forEach((el) => el.remove());
    if (serverError) {
      const err = document.createElement("div");
      err.className = "swb-error";
      err.textContent = "서버 이력을 불러오지 못했습니다 (E-EXT-NET-1001)";
      bodyEl.appendChild(err);
    }
  }

  // '지금 사도 돼' 배지 — 서버 전체 통계(역대 최저/평균)와 현재가 비교 (v0.4)
  // 기록 3개 미만은 평균 비교가 무의미 → '기록 N개 · 데이터 쌓이는 중' 안내 (오탐 방지)
  function renderDealBadge(panel, nowPrice) {
    const deal = panel.querySelector(".swb-deal");
    if (!deal) return;
    deal.classList.add("hidden");
    deal.className = "swb-deal hidden";
    if (!nowPrice || !serverStatsCache || serverStatsCache.avg_price == null) return;

    if (serverStatsCache.price_count != null && serverStatsCache.price_count < 3) {
      deal.className = "swb-deal warn";
      deal.textContent = `기록 ${serverStatsCache.price_count}개 · 데이터 쌓이는 중`;
      deal.classList.remove("hidden");
      return;
    }

    const cur = Number(nowPrice);
    const min = serverStatsCache.min_price != null ? Number(serverStatsCache.min_price) : null;
    const avg = Number(serverStatsCache.avg_price);

    if (min != null && cur <= min) {
      deal.className = "swb-deal";
      deal.textContent = "역대 최저가 🎉";
    } else if (cur < avg) {
      const pct = (((avg - cur) / avg) * 100).toFixed(1);
      deal.className = "swb-deal hot";
      deal.textContent = `평균보다 ${pct}% 저렴 🔥`;
    } else if (cur > avg) {
      const pct = (((cur - avg) / avg) * 100).toFixed(1);
      deal.className = "swb-deal warn";
      deal.textContent = `평균보다 ${pct}% 비쌈`;
    } else {
      deal.className = "swb-deal";
      deal.textContent = "평균 가격 수준";
    }
    deal.classList.remove("hidden");
  }

  // 가격 정보 갱신 배지 — 마지막 캡처로부터 오래될수록 확인 권유 (v0.4 방문 유도)
  function staleCheckLabel(lastCheckedAt, opt = {}) {
    if (!lastCheckedAt) return null;
    const d = new Date(lastCheckedAt);
    if (isNaN(d.getTime())) return null;
    const DAY = 24 * 60 * 60 * 1000;
    const diff = Date.now() - d.getTime();
    if (diff < DAY) return null;
    const days = Math.floor(diff / DAY);
    const text = `확인 필요 · ${days}일 전`;
    return days >= (opt.staleDays ?? 3) ? { text, stale: true } : null;
  }

  async function getDeviceId() {
    const stored = await chrome.storage.local.get("deviceId");
    return stored.deviceId || null;
  }

  let watchCache = []; // v0.7.4 — 찜 목록 캐시 (몰 필터 로컬 처리)
  let watchMallFilter = "all";
  let alertBadgeEl = null; // v0.7.6 — 메뉴 알림 개수 배지
  let dealDaysView = 7; // v0.7.6 — 플로팅 핫딜 기간
  const mallMeta = {
    naver: { label: "네이버", cls: "b-naver", icon: "https://www.google.com/s2/favicons?domain=www.naver.com&sz=32" },
    coupang: { label: "쿠팡", cls: "b-coupang", icon: "https://www.google.com/s2/favicons?domain=www.coupang.com&sz=32" },
    oliveyoung: { label: "올영", cls: "b-oliveyoung", icon: "https://www.google.com/s2/favicons?domain=www.oliveyoung.co.kr&sz=32" },
  };

  // v0.7.6 — 플로팅 오늘의 핫딜
  async function loadDealsView() {
    const box = shadow.querySelector(".swb-view-deals .swb-deals");
    box.innerHTML = `<div class="swb-loading"><span class="swb-spinner"></span>불러오는 중…</div>`;
    let deals;
    try {
      deals = await SWB_API(`/recommendations?limit=5&days=${dealDaysView}`);
    } catch {
      box.innerHTML = `<div class="swb-error">서버에 연결할 수 없습니다 (E-EXT-NET-1001)</div>`;
      return;
    }
    if (!deals.length) {
      box.innerHTML = `<div class="swb-empty">아직 하락 기록이 없습니다.<br>쇼핑을 하면 자동으로 쌓여요!</div>`;
      return;
    }
    box.innerHTML = "";
    for (const d of deals) {
      const m = mallMeta[d.mall] || null;
      const img = d.image ? ` style="background-image:url('${String(d.image).replace(/'/g, "\\'")}')"` : "";
      const badge = m ? `<em class="swb-li-badge ${m.cls}"><img src="${m.icon}" alt="${m.label}"></em>` : "";
      const row = document.createElement("div");
      row.className = "swb-deal-li";
      row.innerHTML = `
        <span class="swb-li-thumb"${img}>${d.image ? "" : (m ? "" : "?")}${badge}</span>
        <span class="swb-deal-body">
          <span class="swb-deal-name"></span>
          <span class="swb-deal-price"></span>
        </span>
        <span class="swb-deal-pct">${d.reason === "low" ? "최저가" : `▼ ${d.drop_percent}%`}</span>`;
      const badgeImg = m ? row.querySelector(".swb-li-badge img") : null;
      if (badgeImg) {
        badgeImg.addEventListener("error", () => {
          badgeImg.replaceWith(document.createTextNode(m.label));
          badgeImg.parentElement.classList.add("b-fallback");
        });
      }
      row.querySelector(".swb-deal-name").textContent = d.name || d.product_id;
      row.querySelector(".swb-deal-price").textContent = `${Number(d.last_price).toLocaleString()}원`;
      if (d.previous_price) {
        const before = document.createElement("span");
        before.className = "swb-deal-before";
        before.textContent = `${Number(d.previous_price).toLocaleString()}원`;
        row.querySelector(".swb-deal-price").appendChild(before);
      }
      row.addEventListener("click", () => {
        if (d.url) chrome.runtime.sendMessage({ type: "OPEN_TAB", url: d.url });
      });
      box.appendChild(row);
    }
  }

  // v0.7.6 — 플로팅 알림 내역 (팝업에서 이동)
  async function loadAlertsView() {
    const box = shadow.querySelector(".swb-view-alerts .swb-alerts");
    const deviceId = await getDeviceId();
    if (!deviceId) {
      box.innerHTML = `<div class="swb-error">기기 등록이 필요합니다.<br>설정 → 기기 정보를 확인해 주세요.</div>`;
      return;
    }
    box.innerHTML = `<div class="swb-loading"><span class="swb-spinner"></span>불러오는 중…</div>`;
    let alerts;
    try {
      alerts = await SWB_API(`/devices/${deviceId}/alerts/history`);
    } catch {
      box.innerHTML = `<div class="swb-error">서버에 연결할 수 없습니다 (E-EXT-NET-1001)</div>`;
      return;
    }
    if (alertBadgeEl) {
      alertBadgeEl.textContent = String(alerts.length);
      alertBadgeEl.style.display = alerts.length ? "flex" : "none";
    }
    if (!alerts.length) {
      box.innerHTML = `<div class="swb-empty">알림 내역이 없습니다.<br>찜한 상품의 가격이 내려가면 여기에 표시됩니다.</div>`;
      return;
    }
    box.innerHTML = "";
    for (const a of alerts) {
      const m = mallMeta[a.mall] || null;
      const d = new Date(a.created_at);
      const ts = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      const img = a.image ? ` style="background-image:url('${String(a.image).replace(/'/g, "\\'")}')"` : "";
      const badge = m ? `<em class="swb-li-badge ${m.cls}"><img src="${m.icon}" alt="${m.label}"></em>` : "";
      const row = document.createElement("div");
      row.className = "swb-alert-li";
      row.innerHTML = `
        <span class="swb-li-thumb"${img}>${a.image ? "" : (m ? "" : "?")}${badge}</span>
        <span class="swb-alert-badge">▼ 하락</span>
        <span class="swb-alert-body">
          <span class="swb-alert-name"></span>
          <span class="swb-alert-meta"></span>
        </span>`;
      const badgeImg = m ? row.querySelector(".swb-li-badge img") : null;
      if (badgeImg) {
        badgeImg.addEventListener("error", () => {
          badgeImg.replaceWith(document.createTextNode(m.label));
          badgeImg.parentElement.classList.add("b-fallback");
        });
      }
      row.querySelector(".swb-alert-name").textContent = a.product_name || a.product_id;
      row.querySelector(".swb-alert-meta").textContent = `${Number(a.price).toLocaleString()}원 · ${ts}`;
      row.addEventListener("click", () => {
        if (a.url) chrome.runtime.sendMessage({ type: "OPEN_TAB", url: a.url });
      });
      box.appendChild(row);
    }
  }

  async function loadWatchList() {
    const listEl = shadow.querySelector(".swb-view-list .swb-list");
    const deviceId = await getDeviceId();
    if (!deviceId) {
      listEl.innerHTML = `<div class="swb-error">기기 등록이 필요합니다.<br>설정 → 기기 정보를 확인해 주세요.</div>`;
      return;
    }
    listEl.innerHTML = `<div class="swb-loading"><span class="swb-spinner"></span>불러오는 중…</div>`;
    try {
      watchCache = await SWB_API(`/devices/${encodeURIComponent(deviceId)}/watches`);
    } catch {
      listEl.innerHTML = `<div class="swb-error">서버에 연결할 수 없습니다 (E-EXT-NET-1001)</div>`;
      return;
    }
    renderWatchList();
  }

  function renderWatchList() {
    const listEl = shadow.querySelector(".swb-view-list .swb-list");
    const countEl = shadow.querySelector(".swb-list-count");
    countEl.textContent = watchCache.length ? `찜 목록 (${watchCache.length})` : "찜 목록";
    const filtered =
      watchMallFilter === "all" ? watchCache : watchCache.filter((w) => w.mall === watchMallFilter);
    if (!filtered.length) {
      listEl.innerHTML = watchCache.length
        ? `<div class="swb-empty">이 몰에서 찜한 상품이 없습니다.</div>`
        : `<div class="swb-empty">찜한 상품이 없습니다.<br>상품 페이지에서 찜을 등록해 보세요.</div>`;
      return;
    }
    listEl.innerHTML = "";
    for (const w of filtered) {
      const m = mallMeta[w.mall] || null;
      const img = w.image ? ` style="background-image:url('${String(w.image).replace(/'/g, "\\'")}')"` : "";
      const badge = m
        ? `<em class="swb-li-badge ${m.cls}"><img src="${m.icon}" alt="${m.label}"></em>`
        : "";
      const row = document.createElement("div");
      row.className = "swb-li";
      row.innerHTML = `
        <span class="swb-li-thumb"${img}>${w.image ? "" : (m ? "" : "?")}${badge}</span>
        <span class="swb-li-body">
          <span class="swb-li-name"></span>
          <span class="swb-li-price"></span>
          <span class="swb-li-check"></span>
        </span>
        <button class="swb-li-del" title="삭제">✕</button>`;
      const badgeImg = m ? row.querySelector(".swb-li-badge img") : null;
      if (badgeImg) {
        badgeImg.addEventListener("error", () => {
          badgeImg.replaceWith(document.createTextNode(m.label));
          badgeImg.parentElement.classList.add("b-fallback");
        });
      }
      row.querySelector(".swb-li-name").textContent = w.product_name || w.product_id;
      row.querySelector(".swb-li-price").textContent =
        w.last_price != null ? `${Number(w.last_price).toLocaleString()}원` : "";
      const chk = staleCheckLabel(w.last_checked_at);
      const chkEl = row.querySelector(".swb-li-check");
      if (chk) {
        chkEl.textContent = chk.text;
        chkEl.classList.add("stale");
      }
      row.querySelector(".swb-li-del").addEventListener("click", (e) => {
        e.stopPropagation();
        const label = (w.product_name || w.product_id).slice(0, 20);
        confirmDialog(`'${label}…' 찜을 삭제할까요?`, async () => {
          await deleteWatch(deviceId, w.product_id);
          loadWatchList();
        });
      });
      row.addEventListener("click", () => {
        if (w.url) chrome.runtime.sendMessage({ type: "OPEN_TAB", url: w.url });
      });
      listEl.appendChild(row);
    }
  }

  // shadow DOM 내 컨펌 다이얼로그 (window.confirm 금지 — MV3)
  function confirmDialog(message, onConfirm) {
    let ov = shadow.querySelector(".swb-confirm");
    if (ov) ov.remove();
    ov = document.createElement("div");
    ov.className = "swb-confirm";
    ov.innerHTML = `
      <div class="swb-confirm-box">
        <div class="swb-confirm-msg"></div>
        <div class="swb-confirm-actions">
          <button class="swb-confirm-no">취소</button>
          <button class="swb-confirm-yes">삭제</button>
        </div>
      </div>`;
    ov.querySelector(".swb-confirm-msg").textContent = message;
    const close = () => ov.remove();
    ov.querySelector(".swb-confirm-no").addEventListener("click", close);
    ov.querySelector(".swb-confirm-yes").addEventListener("click", () => {
      close();
      onConfirm();
    });
    ov.addEventListener("click", (e) => {
      if (e.target === ov) close();
    });
    shadow.appendChild(ov);
  }

  async function deleteWatch(deviceId, productId) {
    try {
      await SWB_API(`/devices/${encodeURIComponent(deviceId)}/watches/${encodeURIComponent(productId)}`, {
        method: "DELETE",
      });
    } catch {
      // E-EXT-NET-1001 — 목록 새로고침 시 재시도 가능
    }
  }

  function drawChart(canvas, prices) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    prices = prices.filter((v) => v != null);
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
    currentParsed = null;
    menuOpen = false;
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
