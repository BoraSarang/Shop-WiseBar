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
      position: fixed; right: calc(20px + 46px + 12px); top: 75vh; transform: translateY(-50%); z-index: 2147483647;
      width: 320px; background: #fff; border-radius: 12px;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.22);
      overflow: hidden; display: flex; flex-direction: column;
      color: #1c1c1e; font-size: 13px;
    }
    .swb-panel.hidden { display: none; }
    .swb-head {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 14px; background: #2d4ae0; color: #fff;
    }
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
    .swb-foot { padding: 8px 14px 12px; font-size: 11px; color: #aaa; }
    .swb-list { padding: 6px 14px 12px; max-height: 380px; overflow-y: auto; }
    .swb-li {
      display: flex; align-items: center; gap: 10px; width: 100%;
      padding: 10px 0; border: none; background: none; cursor: pointer;
      border-bottom: 1px solid #f0f0f0; text-align: left;
    }
    .swb-li:last-child { border-bottom: none; }
    .swb-li-name { flex: 1; min-width: 0; font-size: 12px; color: #333; line-height: 1.35; max-height: 2.6em; overflow: hidden; }
    .swb-li-price { font-size: 12px; font-weight: 700; color: #2d4ae0; white-space: nowrap; }
    .swb-li-del { background: none; border: none; color: #ccc; font-size: 14px; cursor: pointer; padding: 4px; }
    .swb-li-del:hover { color: #e5484d; }
    .swb-loading { padding: 24px 14px; text-align: center; color: #aaa; }
    .swb-error { padding: 24px 14px; text-align: center; color: #e5484d; line-height: 1.6; }
    .swb-empty { padding: 24px 14px; text-align: center; color: #aaa; }
  `;

  const ICON = {
    fab: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 7"></polyline><polyline points="15 7 21 7 21 13"></polyline></svg>`,
    trend: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>`,
    watch: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`,
    settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
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
    panel.innerHTML = `
      <div class="swb-head">
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
        </div>
        <div class="swb-foot">똑바 · 가격은 상품 페이지를 볼 때마다 자동 기록됩니다</div>
      </div>
      <div class="swb-view swb-view-list">
        <div class="swb-list"></div>
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
    shadow.appendChild(panel);

    buildMenu(menu);
  }

  function buildMenu(menu) {
    const items = [
      { key: "trend", label: "가격 추이", icon: ICON.trend },
      { key: "list", label: "찜 목록", icon: ICON.watch },
      { key: "set", label: "설정", icon: ICON.settings },
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
      menu.appendChild(btn);
    });
  }

  function toggleMenu() {
    menuOpen = !menuOpen;
    const fab = shadow.querySelector(".swb-fab");
    const menu = shadow.querySelector(".swb-menu");
    fab.classList.toggle("open", menuOpen);
    menu.classList.toggle("open", menuOpen);
    if (menuOpen) {
      hideTooltip();
      refreshWatchState();
    } else closePanel();
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

  function showPanel() {
    const panel = shadow.querySelector(".swb-panel");
    panel.classList.remove("hidden");
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
    const titles = { trend: "가격 변동 추이", list: "찜 목록 관리", set: "설정" };
    panel.querySelector(".swb-head-title").textContent = titles[name] || "";
    const back = panel.querySelector(".swb-head-back");
    back.style.visibility = name === "trend" ? "hidden" : "visible";
    panel.classList.remove("hidden");
  }

  async function onMenuItem(key) {
    if (key === "set") {
      closeAll();
      chrome.runtime.openOptionsPage();
      return;
    }
    toggleMenu();
    showPanel();
    if (key === "trend") {
      showView("trend");
      loadTrend();
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
      const base = `${SWB_CONFIG.server}${SWB_CONFIG.api}`;
      const deviceId = await getDeviceId();
      if (!deviceId) return;
      const res = await fetch(
        `${base}/products/${encodeURIComponent(currentParsed.productID)}?device_id=${encodeURIComponent(deviceId)}`
      );
      if (!res.ok) return;
      const p = await res.json();
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
    const base = `${SWB_CONFIG.server}${SWB_CONFIG.api}`;
    try {
      if (currentWatched) {
        await fetch(`${base}/devices/${encodeURIComponent(deviceId)}/watches/${pid}`, { method: "DELETE" });
        currentWatched = false;
      } else {
        await fetch(`${base}/devices/${encodeURIComponent(deviceId)}/watches/${pid}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target_price: null }),
        });
        currentWatched = true;
      }
      updateWatchBtn();
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
    const live = Extractor.extract(parsed.mall);
    nowPriceCache = Number(live.price) || null;
    const { title, brand } = splitTitle(live.title);
    titleEl.textContent = title || parsed.productID;
    brandEl.textContent = brand;

    // 2) 서버 이력 조회 → 캐시 (실패해도 현재 가격으로 그래프는 표시)
    let serverError = false;
    currentWatched = false;
    updateWatchBtn();
    try {
      const base = `${SWB_CONFIG.server}${SWB_CONFIG.api}`;
      const deviceId = await getDeviceId();
      const [product, points] = await Promise.all([
        fetch(`${base}/products/${pid}${deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : ""}`).then((r) => (r.ok ? r.json() : null)),
        fetch(`${base}/products/${pid}/prices?limit=200`).then((r) => (r.ok ? r.json() : [])),
      ]);
      pointsCache = points || [];
      if (product) {
        if (!nowPriceCache && product.last_price) nowPriceCache = Number(product.last_price);
        if (product.is_watched) currentWatched = true;
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

    bodyEl.querySelectorAll(".swb-error").forEach((el) => el.remove());
    if (serverError) {
      const err = document.createElement("div");
      err.className = "swb-error";
      err.textContent = "서버 이력을 불러오지 못했습니다 (E-EXT-NET-1001)";
      bodyEl.appendChild(err);
    }
  }

  async function getDeviceId() {
    const stored = await chrome.storage.local.get("deviceId");
    return stored.deviceId || null;
  }

  async function loadWatchList() {
    const listEl = shadow.querySelector(".swb-view-list .swb-list");
    const deviceId = await getDeviceId();
    if (!deviceId) {
      listEl.innerHTML = `<div class="swb-error">기기 등록이 필요합니다.<br>설정 → 기기 정보를 확인해 주세요.</div>`;
      return;
    }
    listEl.innerHTML = `<div class="swb-loading">불러오는 중…</div>`;
    let watches = [];
    try {
      const base = `${SWB_CONFIG.server}${SWB_CONFIG.api}`;
      const res = await fetch(`${base}/devices/${encodeURIComponent(deviceId)}/watches`);
      if (!res.ok) throw new Error("http " + res.status);
      watches = await res.json();
    } catch {
      listEl.innerHTML = `<div class="swb-error">서버에 연결할 수 없습니다 (E-EXT-NET-1001)</div>`;
      return;
    }
    if (!watches.length) {
      listEl.innerHTML = `<div class="swb-empty">찜한 상품이 없습니다.<br>상품 페이지에서 찜을 등록해 보세요.</div>`;
      return;
    }
    listEl.innerHTML = "";
    for (const w of watches) {
      const row = document.createElement("div");
      row.className = "swb-li";
      row.innerHTML = `
        <span class="swb-li-name"></span>
        <span class="swb-li-price"></span>
        <button class="swb-li-del" title="삭제">✕</button>`;
      const nameEl = row.querySelector(".swb-li-name");
      const priceEl = row.querySelector(".swb-li-price");
      nameEl.textContent = w.product_name || w.product_id;
      priceEl.textContent = w.last_price != null ? `${Number(w.last_price).toLocaleString()}원` : "";
      row.querySelector(".swb-li-del").addEventListener("click", async (e) => {
        e.stopPropagation();
        await deleteWatch(deviceId, w.product_id);
        loadWatchList();
      });
      row.addEventListener("click", () => {
        if (w.url) chrome.runtime.sendMessage({ type: "OPEN_TAB", url: w.url });
      });
      listEl.appendChild(row);
    }
  }

  async function deleteWatch(deviceId, productId) {
    try {
      const base = `${SWB_CONFIG.server}${SWB_CONFIG.api}`;
      await fetch(`${base}/devices/${encodeURIComponent(deviceId)}/watches/${encodeURIComponent(productId)}`, {
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
