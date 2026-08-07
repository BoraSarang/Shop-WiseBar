// swb-ui.js — 똑바 플로팅 버튼 + 툴팁 + 180° 펼침 메뉴 + 패널 (shadow DOM 격리)
// 메뉴: 가격 추이 / 찜 목록 관리 / 설정 — v0.3.2
// E-EXT-NET-1001: 서버 연결 실패 / E-EXT-VALID-3001: 추출 실패

const SWB_UI = (() => {
  let host = null;
  let shadow = null;
  let currentParsed = null;
  let menuOpen = false;
  let currentWatched = false;
  let currentTargetPrice = null; // v0.9.2 — 목표가 (찜 상태일 때)
  let menuWatchBtn = null;
  let rangeDays = 7;
  let pointsCache = [];
  let nowPriceCache = null;
  let serverStatsCache = null;
  let trendStatsCache = null; // v0.10.0 — 7일/30일/역대 요약

  const CSS = `
    :host {
      all: initial;
      --swb-primary: #2d4ae0;
      --swb-primary-strong: #3a5aef;
      --swb-primary-soft: #f2f4ff;
      --swb-primary-soft-2: #eef1ff;
      --swb-primary-border: #d5ddfb;
      --swb-danger: #e5484d;
      --swb-danger-soft: #fff8f6;
      --swb-danger-soft-2: #fdeeea;
      --swb-warn: #8a8f98;
      --swb-alert-target: #6741d9;
      --swb-text: #1c1c1e;
      --swb-text-secondary: #555;
      --swb-text-muted: #8a8f98;
      --swb-text-faint: #aaa;
      --swb-border: #eee;
      --swb-border-strong: #dde1e6;
      --swb-surface: #ffffff;
      --swb-surface-soft: #f7f8fa;
      --swb-mall-naver: #03c75a;
      --swb-mall-coupang: #0074e9;
      --swb-mall-oliveyoung: #56a99c;
      --swb-scroll-thumb: #c7cede;
      --swb-font: -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
      --swb-fs-xxs: 10px;
      --swb-fs-xs: 11px;
      --swb-fs-sm: 12px;
      --swb-fs-base: 13px;
      --swb-fs-md: 15px;
      --swb-fs-lg: 17px;
      --swb-fs-xl: 20px;
      --swb-space-1: 4px;
      --swb-space-2: 8px;
      --swb-space-3: 12px;
      --swb-space-4: 16px;
      --swb-space-5: 20px;
      --swb-space-6: 24px;
      --swb-radius-sm: 6px;
      --swb-radius-md: 8px;
      --swb-radius-lg: 12px;
      --swb-radius-pill: 999px;
      --swb-shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.06);
      --swb-shadow-md: 0 2px 10px rgba(0, 0, 0, 0.05);
      --swb-shadow-lg: 0 12px 32px rgba(0, 0, 0, 0.22);
      --swb-shadow-brand: 0 4px 14px rgba(45, 74, 224, 0.45);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: var(--swb-font); }
    .swb-fab {
      position: fixed; right: 20px; bottom: calc(25vh - 23px); z-index: 2147483647;
      width: 46px; height: 46px; border-radius: 50%;
      background: var(--swb-primary); color: #fff; border: none; cursor: pointer;
      box-shadow: var(--swb-shadow-brand);
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .swb-fab:hover { box-shadow: var(--swb-shadow-brand); }
    .swb-fab.open { transform: rotate(180deg) scale(1.06); }
    .swb-fab svg { width: 22px; height: 22px; }
    .swb-tooltip {
      position: fixed; z-index: 2147483647; pointer-events: none;
      background: var(--swb-surface); color: var(--swb-primary); font-size: var(--swb-fs-sm); font-weight: 700;
      padding: 4px 10px; border-radius: var(--swb-radius-md); box-shadow: 0 4px 14px rgba(0,0,0,0.18);
      opacity: 0; transform: translateX(-6px); transition: opacity 0.15s ease, transform 0.15s ease;
      white-space: nowrap;
    }
    .swb-tooltip.show { opacity: 1; transform: translateX(0); }
    .swb-menu {
      position: fixed; z-index: 2147483647; width: 0; height: 0;
      right: calc(20px + 23px); bottom: 25vh; /* FAB 중심을 원점(0,0)으로 (v0.11.0 후속: 25vh 복원) */
      opacity: 0; pointer-events: none;
      transition: opacity 0.18s ease;
    }
    .swb-menu.open { opacity: 1; pointer-events: auto; }
    .swb-mi {
      position: absolute; left: 0; top: 0; margin-left: -20px; margin-top: -20px;
      display: flex; align-items: center; justify-content: center;
      width: 40px; height: 40px; border-radius: 50%;
      background: var(--swb-surface); color: var(--swb-primary); border: none; cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.18);
      transition: transform 0.22s ease, background 0.15s ease, color 0.15s ease, opacity 0.18s ease;
      opacity: 0; transform: translate(var(--mx, 0px), var(--my, 0px)) scale(0.4);
    }
    .swb-menu.open .swb-mi { opacity: 1; transform: translate(var(--mx, 0px), var(--my, 0px)) scale(1); }
    .swb-mibadge { position: absolute; top: 0; right: 0; min-width: 15px; height: 15px; border-radius: 8px; background: var(--swb-danger); color: #fff; font-size: var(--swb-fs-xxs); font-weight: 800; align-items: center; justify-content: center; padding: 0 3px; }
    .swb-mi:hover { background: var(--swb-primary); color: #fff; }
    .swb-mi.active { background: var(--swb-danger); color: #fff; }
    .swb-mi.active:hover { background: var(--swb-danger); }
    .swb-mi svg { width: 18px; height: 18px; }
    .swb-mi-label {
      position: absolute; right: calc(100% + 8px); white-space: nowrap;
      font-size: var(--swb-fs-xs); font-weight: 600; color: var(--swb-text-secondary);
      background: var(--swb-surface); padding: 3px 8px; border-radius: var(--swb-radius-sm);
      box-shadow: 0 2px 8px rgba(0,0,0,0.14); opacity: 0; transform: translateX(4px);
      transition: opacity 0.12s ease, transform 0.12s ease; pointer-events: none;
      top: 50%; margin-top: -12px;
    }
    .swb-mi-label.l-above { right: auto; left: 50%; transform: translateX(-50%) translateY(-4px); top: calc(100% + 6px); margin-top: 0; }
    .swb-mi-label.l-below { right: auto; left: 50%; transform: translateX(-50%) translateY(4px); bottom: calc(100% + 6px); margin-top: 0; }
    .swb-mi:hover .swb-mi-label { opacity: 1; transform: translateX(0); }
    .swb-mi:hover .swb-mi-label.l-above, .swb-mi:hover .swb-mi-label.l-below { opacity: 1; transform: translateX(-50%) translateY(0); }
    .swb-panel {
      position: fixed; right: calc(20px + 46px + 12px); top: 75vh; z-index: 2147483647;
      width: 320px; max-height: calc(100vh - 24px);
      background: var(--swb-surface); border-radius: var(--swb-radius-lg);
      box-shadow: var(--swb-shadow-lg);
      overflow-y: auto; display: flex; flex-direction: column;
      color: var(--swb-text); font-size: var(--swb-fs-base);
    }
    .swb-panel.hidden { display: none; }
    .swb-head {
      display: flex; align-items: center; gap: var(--swb-space-2);
      padding: 10px var(--swb-space-4); background: var(--swb-primary); color: #fff;
    }
    .swb-head-icon { display: flex; align-items: center; }
    .swb-head-icon svg { width: 16px; height: 16px; }
    .swb-head-back { background: none; border: none; color: #fff; font-size: var(--swb-fs-md); cursor: pointer; padding: 0 2px; line-height: 1; }
    .swb-head-title { flex: 1; font-weight: 600; font-size: var(--swb-fs-base); }
    .swb-close { background: none; border: none; color: #fff; font-size: 16px; cursor: pointer; line-height: 1; padding: 2px; }
    .swb-view { display: none; }
    .swb-view.active { display: block; }
    .swb-body { padding: var(--swb-space-3) var(--swb-space-4) var(--swb-space-2); }
    .swb-title-area { padding: var(--swb-space-3) var(--swb-space-4) 0; }
    .swb-title { font-weight: 600; font-size: var(--swb-fs-base); line-height: 1.4; max-height: 2.8em; overflow: hidden; }
    .swb-brand { font-size: var(--swb-fs-xs); opacity: 0.8; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .swb-price-row { display: flex; align-items: baseline; gap: var(--swb-space-2); margin-bottom: var(--swb-space-2); }
    .swb-now { font-size: var(--swb-fs-xl); font-weight: 800; }
    .swb-delta { font-size: var(--swb-fs-sm); font-weight: 700; }
    .swb-delta.down { color: var(--swb-primary); }
    .swb-delta.up { color: var(--swb-danger); }
    .swb-range { display: flex; gap: var(--swb-space-1); margin-bottom: 10px; }
    .swb-range-btn {
      flex: 1; padding: 4px 0; font-size: var(--swb-fs-xs); font-weight: 600;
      background: var(--swb-primary-soft); color: var(--swb-primary); border: none; border-radius: var(--swb-radius-md); cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease;
    }
    .swb-range-btn.active { background: var(--swb-primary); color: #fff; }
    .swb-watch {
      position: relative;
      margin-left: auto; align-self: center;
      background: none; border: none; cursor: pointer;
      color: var(--swb-text-faint); padding: 4px;
      transition: color 0.15s ease, transform 0.15s ease;
    }
    .swb-watch:hover { transform: scale(1.12); color: var(--swb-danger); }
    .swb-watch.active { color: var(--swb-danger); }
    .swb-watch.active svg { fill: currentColor; }
    .swb-watch svg { width: 20px; height: 20px; }
    .swb-watch-label {
      position: absolute; right: calc(100% + 8px); top: 50%;
      transform: translate(4px, -50%);
      white-space: nowrap; font-size: var(--swb-fs-xs); font-weight: 600; color: var(--swb-text-secondary);
      background: var(--swb-surface); padding: 3px 8px; border-radius: var(--swb-radius-sm);
      box-shadow: 0 2px 8px rgba(0,0,0,0.14); opacity: 0;
      transition: opacity 0.12s ease, transform 0.12s ease; pointer-events: none;
    }
    /* v0.9.2 — 가격 추이 목표가 행 (팝업과 동일 디자인) */
    .swb-target-row {
      display: flex; flex-direction: column; align-items: stretch;
      margin: 6px 0; padding: 8px 10px;
      background: var(--swb-surface-soft); border-radius: var(--swb-radius-md);
    }
    /* v0.9.6 — 찜 해제 시 목표가 행 숨김 (hidden 클래스 규칙 누락으로 flex 유지되던 버그) */
    .swb-target-row.hidden { display: none; }
    .swb-target-status {
      font-size: var(--swb-fs-xs); color: var(--swb-text-muted); text-align: right; margin-bottom: 4px;
    }
    .swb-target-status.on { color: var(--swb-primary); font-weight: 600; }
    .swb-target-controls {
      display: flex; justify-content: flex-end; align-items: center; gap: 5px;
    }
    .swb-target-input {
      width: 100px; padding: 5px 6px; flex-shrink: 1; min-width: 0;
      border: 1px solid var(--swb-border-strong); border-radius: var(--swb-radius-sm);
      font-size: var(--swb-fs-sm); text-align: right; background: var(--swb-surface);
    }
    .swb-target-input:focus { outline: none; border-color: var(--swb-primary); }
    .swb-target-save {
      border: none; border-radius: var(--swb-radius-sm); padding: 5px 7px; font-size: var(--swb-fs-xs);
      cursor: pointer; background: var(--swb-primary); color: #fff; flex-shrink: 0;
    }
    .swb-target-clear {
      border: none; border-radius: var(--swb-radius-sm); padding: 5px 7px; font-size: var(--swb-fs-xs);
      cursor: pointer; background: var(--swb-surface-soft); color: var(--swb-text-secondary); flex-shrink: 0;
    }
    .swb-target-clear:disabled { opacity: .45; cursor: default; }
    .swb-watch:hover .swb-watch-label { opacity: 1; transform: translate(0, -50%); }
    .swb-chart-wrap { position: relative; }
    canvas.swb-chart { width: 100%; height: 140px; display: block; }
    .swb-xaxis { display: flex; justify-content: space-between; font-size: var(--swb-fs-xxs); color: var(--swb-text-faint); margin-top: 2px; }
    .swb-stats { display: flex; gap: var(--swb-space-3); margin-top: var(--swb-space-2); font-size: var(--swb-fs-xs); color: var(--swb-text-muted); }
    .swb-stats b { color: var(--swb-text-secondary); }
    .swb-trend-stats {
      margin-top: var(--swb-space-2); padding: 5px 10px; border-radius: var(--swb-radius-md);
      background: var(--swb-primary-soft-2); color: var(--swb-primary); font-size: var(--swb-fs-xs); font-weight: 700;
      line-height: 1.5;
    }
    .swb-deal {
      display: inline-block; margin: var(--swb-space-2) 0 0; padding: 3px 8px; border-radius: var(--swb-radius-md);
      font-size: var(--swb-fs-xs); font-weight: 800; color: #fff; background: var(--swb-primary);
    }
    .swb-deal.hot { background: var(--swb-danger); }
    .swb-deal.warn { background: var(--swb-warn); }
    .swb-deal.hidden { display: none; }
    .swb-related { margin-top: 10px; border-top: 1px solid var(--swb-border); padding-top: var(--swb-space-2); }
    .swb-related.hidden { display: none; } /* v0.9.6 — 관계 데이터 없을 때 숨김 (규칙 누락 버그) */
    .swb-rel-title { font-size: var(--swb-fs-xs); font-weight: 700; color: var(--swb-text-secondary); margin-bottom: 6px; }
    .swb-rel-li {
      display: flex; align-items: center; gap: var(--swb-space-2); padding: 5px 6px; border-radius: var(--swb-radius-md);
      cursor: pointer; transition: background 0.12s ease;
    }
    .swb-rel-li:hover { background: var(--swb-primary-soft); }
    .swb-rel-name { flex: 1; font-size: var(--swb-fs-xs); color: var(--swb-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .swb-rel-price { font-size: var(--swb-fs-xs); font-weight: 700; color: var(--swb-primary); }
    .swb-rel-loading { font-size: var(--swb-fs-xs); color: var(--swb-text-faint); padding: 4px 6px; }
    .swb-rel-empty { font-size: var(--swb-fs-xs); color: var(--swb-text-faint); padding: 4px 6px; }
    .swb-foot { padding: var(--swb-space-2) var(--swb-space-4) var(--swb-space-3); font-size: var(--swb-fs-xs); color: var(--swb-text-faint); }
    .swb-list { padding: 6px var(--swb-space-4) var(--swb-space-3); max-height: 340px; overflow-y: auto; }
    .swb-list-head { display: flex; align-items: center; justify-content: space-between; padding: var(--swb-space-2) var(--swb-space-4) 0; }
    .swb-list-count { font-size: var(--swb-fs-sm); font-weight: 700; color: var(--swb-text-secondary); }
    .swb-mall-filter { display: flex; gap: var(--swb-space-1); }
    .swb-mf-btn { font-size: var(--swb-fs-xxs); font-weight: 700; color: var(--swb-primary); background: var(--swb-surface); border: 1px solid var(--swb-primary-border); border-radius: var(--swb-radius-lg); padding: 2px 8px; cursor: pointer; }
    .swb-mf-btn.active { background: var(--swb-primary); color: #fff; border-color: var(--swb-primary); }
    .swb-deals-head { padding: var(--swb-space-2) var(--swb-space-4) 0; display: flex; justify-content: flex-end; }
    .swb-deals-days { display: flex; gap: var(--swb-space-1); }
    .swb-deal-btn { font-size: var(--swb-fs-xxs); font-weight: 700; color: var(--swb-primary); background: var(--swb-surface); border: 1px solid var(--swb-primary-border); border-radius: var(--swb-radius-lg); padding: 2px 8px; cursor: pointer; }
    .swb-deal-btn.active { background: var(--swb-primary); color: #fff; border-color: var(--swb-primary); }
    .swb-deals { padding: 6px var(--swb-space-4) var(--swb-space-3); max-height: 380px; overflow-y: auto; }
    .swb-deal-li { display: flex; align-items: center; gap: var(--swb-space-2); padding: 7px 8px; border-radius: var(--swb-radius-md); background: var(--swb-primary-soft); margin-bottom: 6px; cursor: pointer; }
    .swb-deal-li:hover { background: var(--swb-primary-soft-2); }
    .swb-deal-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .swb-deal-name { font-size: var(--swb-fs-sm); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .swb-deal-price { font-size: var(--swb-fs-sm); font-weight: 700; }
    .swb-deal-before { font-size: var(--swb-fs-xxs); font-weight: 400; color: var(--swb-text-muted); text-decoration: line-through; margin-left: 4px; }
    .swb-deal-meta { display: flex; gap: 4px; align-items: center; margin-top: 1px; }
    .swb-deal-watch { font-size: var(--swb-fs-xxs); font-weight: 600; color: var(--swb-primary); }
    .swb-deal-pct { font-size: var(--swb-fs-xs); font-weight: 800; color: #fff; background: var(--swb-danger); padding: 2px 6px; border-radius: 5px; flex-shrink: 0; }
    .swb-alerts { padding: 6px var(--swb-space-4) var(--swb-space-3); max-height: 380px; overflow-y: auto; }
    .swb-alert-li { display: flex; align-items: center; gap: var(--swb-space-2); padding: 7px 8px; border-radius: var(--swb-radius-md); background: var(--swb-danger-soft); margin-bottom: 6px; cursor: pointer; }
    .swb-alert-li:hover { background: var(--swb-danger-soft-2); }
    .swb-alert-badge { font-size: var(--swb-fs-xxs); font-weight: 800; color: #fff; background: var(--swb-primary); padding: 2px 6px; border-radius: 5px; flex-shrink: 0; }
    .swb-alert-badge.t-target { background: var(--swb-alert-target); }
    .swb-alert-badge.t-soldout { background: var(--swb-danger); }
    .swb-alert-badge.t-drop { background: var(--swb-primary); }
    .swb-alert-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .swb-alert-name { font-size: var(--swb-fs-sm); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .swb-alert-meta { font-size: var(--swb-fs-xs); color: var(--swb-danger); font-weight: 600; }
    .swb-li {
      display: flex; align-items: center; gap: 10px; width: 100%;
      padding: 10px 0; border: none; background: none; cursor: pointer;
      border-bottom: 1px solid var(--swb-border); text-align: left;
    }
    .swb-li:last-child { border-bottom: none; }
    .swb-li-thumb {
      position: relative; width: 44px; height: 44px; border-radius: var(--swb-radius-md); flex-shrink: 0;
      background: var(--swb-primary-soft) center/cover no-repeat;
      display: flex; align-items: center; justify-content: center;
      font-size: var(--swb-fs-md); font-weight: 800; color: var(--swb-primary);
    }
    .swb-li-badge {
      position: absolute; right: 2px; bottom: 2px;
      width: 16px; height: 16px; border-radius: 50%;
      background: var(--swb-surface); display: flex; align-items: center; justify-content: center;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    }
    .swb-li-badge img { width: 11px; height: 11px; border-radius: 3px; }
    .swb-li-badge.b-fallback {
      font-size: 8px; font-weight: 800; color: #fff; font-style: normal;
    }
    .swb-li-badge.b-fallback.b-naver { background: var(--swb-mall-naver); }
    .swb-li-badge.b-fallback.b-coupang { background: var(--swb-mall-coupang); }
    .swb-li-badge.b-fallback.b-oliveyoung { background: var(--swb-mall-oliveyoung); }
    .swb-li-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .swb-li-name { font-size: var(--swb-fs-sm); color: var(--swb-text-secondary); line-height: 1.35; max-height: 2.6em; overflow: hidden; }
    .swb-li-price-row {
      display: flex; align-items: center; justify-content: space-between; gap: 6px; /* v0.9.2 */
    }
    .swb-li-price { font-size: var(--swb-fs-sm); font-weight: 700; color: var(--swb-primary); }
    .swb-li-check { font-size: var(--swb-fs-xxs); color: var(--swb-text-faint); margin-left: auto; text-align: right; white-space: nowrap; }
    .swb-li-check.stale {
      align-self: flex-start; color: var(--swb-danger); background: var(--swb-danger-soft);
      border-radius: var(--swb-radius-md); padding: 1px 8px; font-weight: 700;
    }
    .swb-li-check.sold-out {
      align-self: flex-start; color: var(--swb-danger); background: var(--swb-danger-soft);
      border-radius: var(--swb-radius-md); padding: 1px 8px; font-weight: 800;
    }
    .swb-li-check.target { color: var(--swb-primary); font-weight: 600; }
    /* v0.9.2 — 품절/확인필요 행 배경 */
    .swb-li.sold-out { background: var(--swb-danger-soft); }
    .swb-li.sold-out:hover { background: var(--swb-danger-soft-2); }
    .swb-li.stale { background: #fffdfd; }
    .swb-li.stale:hover { background: var(--swb-surface-soft); }
    .swb-li-del { background: none; border: none; color: var(--swb-text-faint); font-size: 14px; cursor: pointer; padding: 4px; }
    .swb-li-del:hover { color: var(--swb-danger); }
    .swb-confirm {
      position: fixed; inset: 0; z-index: 2147483647;
      background: rgba(0, 0, 0, 0.35);
      display: flex; align-items: center; justify-content: center;
    }
    .swb-confirm-box {
      width: 260px; background: var(--swb-surface); border-radius: var(--swb-radius-lg);
      padding: 18px var(--swb-space-4) var(--swb-space-3); box-shadow: var(--swb-shadow-lg);
    }
    .swb-confirm-msg { font-size: var(--swb-fs-base); color: var(--swb-text-secondary); line-height: 1.5; margin-bottom: 14px; word-break: break-all; }
    .swb-confirm-actions { display: flex; gap: var(--swb-space-2); }
    .swb-confirm-actions button {
      flex: 1; padding: 7px 0; border: none; border-radius: var(--swb-radius-md);
      font-size: var(--swb-fs-sm); font-weight: 700; cursor: pointer;
    }
    .swb-confirm-no { background: var(--swb-primary-soft); color: var(--swb-primary); }
    .swb-confirm-yes { background: var(--swb-danger); color: #fff; }
    .swb-loading { padding: var(--swb-space-6) var(--swb-space-4); text-align: center; color: var(--swb-text-faint); }
    .swb-spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid var(--swb-primary-border); border-top-color: var(--swb-primary); border-radius: 50%; vertical-align: -2px; margin-right: 6px; animation: swb-spin .8s linear infinite; }
    @keyframes swb-spin { to { transform: rotate(360deg); } }
    .swb-error { padding: var(--swb-space-6) var(--swb-space-4); text-align: center; color: var(--swb-danger); line-height: 1.6; }
    .swb-empty { padding: var(--swb-space-6) var(--swb-space-4); text-align: center; color: var(--swb-text-faint); }
    /* v0.11.0 — 접근성: 키보드 포커스 링 */
    .swb-fab:focus-visible,
    .swb-mi:focus-visible,
    .swb-close:focus-visible,
    .swb-head-back:focus-visible,
    .swb-watch:focus-visible,
    .swb-range-btn:focus-visible,
    .swb-mf-btn:focus-visible,
    .swb-deal-btn:focus-visible,
    .swb-li:focus-visible,
    .swb-li-del:focus-visible,
    .swb-confirm-actions button:focus-visible {
      outline: 2px solid var(--swb-primary);
      outline-offset: 2px;
    }
  `;

  const ICON = {
    fab: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 7"></polyline><polyline points="15 7 21 7 21 13"></polyline></svg>`,
    trend: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>`,
    watch: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`,
    settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
    info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
    deal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11h18l-2 8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2l-2-8z"></path><path d="M12 2a4 4 0 0 1 4 4v5h-8V6a4 4 0 0 1 4-4z"></path></svg>`,
    bell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`,
    bug: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="6" width="8" height="14" rx="4"></rect><path d="M8 10h8"></path><path d="M12 6V4a2 2 0 0 1 4-2"></path><path d="M8.5 3L6 4.5"></path><path d="M4 12a4 4 0 0 0 16 0"></path></svg>`,
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
          <div class="swb-target-row hidden">
            <span class="swb-target-status">목표가 미설정</span>
            <div class="swb-target-controls">
              <input class="swb-target-input" type="number" min="1000" step="100" placeholder="목표가 (원)">
              <button class="swb-target-save">목표가 저장</button>
              <button class="swb-target-clear" disabled>설정 해제</button>
            </div>
          </div>
          <div class="swb-chart-wrap"><canvas class="swb-chart" width="292" height="140"></canvas></div>
          <div class="swb-xaxis"><span class="x-start"></span><span class="x-end"></span></div>
          <div class="swb-stats">
            <span>최저가 <b class="st-min">—</b></span>
            <span>최고가 <b class="st-max">—</b></span>
            <span>기록 <b class="st-count">—</b>일</span>
          </div>
          <div class="swb-trend-stats hidden"></div>
          <span class="swb-deal hidden"></span>
          <div class="swb-related hidden">
            <div class="swb-rel-title">함께 본 상품</div>
            <div class="swb-rel-list"></div>
          </div>
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
    panel.querySelector(".swb-target-save").addEventListener("click", (e) => {
      e.stopPropagation();
      saveTargetPrice();
    });
    panel.querySelector(".swb-target-clear").addEventListener("click", (e) => {
      e.stopPropagation();
      clearTargetPrice();
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
    // v0.11.0 후속 — FAB 25vh 복원(메뉴 원점=FAB 중심 일치) + 배치 재구성.
    // FAB 중심을 원점(0,0)으로 위/왼쪽/아래 3방향. 위쪽 열에는 전체 핫딜→가격 추이 순으로 세로 배치해
    // 클릭 즉시 가장 가까운 위치에 노출. 모든 열 아이콘 간격 48px로 통일(라벨-아이콘 겹침 회피).
    // 사용법(help) 메뉴 제거 — 온보딩에서 안내. 아래 열(설정/디버그)은 라벨 dir=above(아이콘 아래).
    const items = [
      { key: "deals", label: "전체 핫딜", icon: ICON.deal, x: 0, y: -108, dir: "left" },
      { key: "trend", label: "가격 추이", icon: ICON.trend, x: 0, y: -60, dir: "left" },
      { key: "alerts", label: "알림", icon: ICON.bell, x: -60, y: 0, dir: "left" },
      { key: "list", label: "찜 목록", icon: ICON.watch, x: -60, y: 48, dir: "left" },
      { key: "set", label: "설정", icon: ICON.settings, x: 0, y: 60, dir: "above" },
    ];
    // v0.9.3 — 디버그 패널 표시(debugEnabled)가 켜져 있을 때만 디버그 메뉴 노출 (추가는 syncDebugMenu가 처리)
    renderMenuItems();
    function renderMenuItems() {
      items.forEach((it, i) => {
        if (menu.querySelector(`[data-key="${it.key}"]`)) return; // 재호출 방지
        const btn = document.createElement("button");
        btn.className = "swb-mi";
        btn.dataset.key = it.key;
        btn.dataset.order = i;
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
        placeMenuItem(btn, it.x, it.y, it.dir);
        menu.appendChild(btn);
      });
    }
  }

  function placeMenuItem(btn, x, y, dir) {
    btn.style.setProperty("--mx", `${x}px`);
    btn.style.setProperty("--my", `${y}px`);
    const label = btn.querySelector(".swb-mi-label");
    if (label) {
      if (dir === "above") label.classList.add("l-above");
      else if (dir === "below") label.classList.add("l-below");
    }
  }

  // v0.9.4 — debugEnabled 토글 시 플로팅 메뉴의 디버그 아이콘을 실시간 추가/제거 (옵션 전환 즉시)
  function syncDebugMenu() {
    const menu = shadow && shadow.querySelector(".swb-menu");
    if (!menu) return;
    chrome.storage.local.get("debugEnabled", (v) => {
      const on = !!(v && v.debugEnabled);
      const existing = menu.querySelector('[data-key="debug"]');
      if (!on) {
        if (existing) existing.remove();
        return;
      }
      if (existing) return;
      const btn = document.createElement("button");
      btn.className = "swb-mi";
      btn.dataset.key = "debug";
      btn.dataset.order = "99";
      btn.innerHTML = `${ICON.bug}<span class="swb-mi-label">디버그</span>`;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        onMenuItem("debug");
      });
      placeMenuItem(btn, 0, 108, "above"); // FAB 세로축 아래, 설정(60)보다 아래 (간격 48px 통일)
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
    // 직각 배치 스태거 — 위→왼쪽→아래 순으로 순차 펼침 (order 기반)
    menu.querySelectorAll(".swb-mi").forEach((b) => {
      const order = parseFloat(b.dataset.order || "0");
      b.style.transitionDelay = `${(order * 0.04).toFixed(3)}s`;
    });
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

  // 패널 위치: FAB(오른쪽 20px, 하단 25vh-23px, 46px) 바로 위에 정렬, 하단이 넘치면 위로 이동
  function positionPanel() {
    const panel = shadow.querySelector(".swb-panel");
    if (!panel || panel.classList.contains("hidden")) return;
    const vh = window.innerHeight;
    const h = panel.getBoundingClientRect().height;
    const fabTop = vh - (vh * 0.25 - 23) - 46; // FAB 상단 y (FAB 하단=25vh-23, 높이 46)
    const desired = fabTop - h;   // 패널 하단 = FAB 상단
    const maxTop = vh - h - 12;   // 브라우저 하단 12px 여유
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
    if (menu) {
      menu.classList.remove("open");
      menu.querySelectorAll(".swb-mi").forEach((b) => (b.style.transitionDelay = ""));
    }
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
    if (key === "debug") {
      closeAll();
      chrome.runtime.sendMessage({ type: "OPEN_DEBUG" });
      return;
    }
    if (key === "set") {
      closeAll();
      chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" }); // openOptionsPage는 content script에서 직접 호출 불가 — background 경유
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
    updateTargetRow(); // v0.9.2
  }

  // v0.9.2 — 가격 추이 목표가 행 갱신 (찜 상태일 때 보임, 목표가 없으면 현재가 기본값)
  function updateTargetRow() {
    const row = shadow.querySelector(".swb-target-row");
    if (!row) return;
    const input = row.querySelector(".swb-target-input");
    const clear = row.querySelector(".swb-target-clear");
    const status = row.querySelector(".swb-target-status");
    row.classList.toggle("hidden", !currentWatched);
    clear.disabled = !currentTargetPrice;
    if (currentWatched) {
      if (currentTargetPrice) {
        input.value = String(currentTargetPrice);
        status.textContent = `${Number(currentTargetPrice).toLocaleString()}원 이하 알림 중`;
        status.classList.add("on");
      } else {
        input.value = nowPriceCache ? String(nowPriceCache) : "";
        status.textContent = "목표가 미설정";
        status.classList.remove("on");
      }
    }
  }

  async function refreshWatchState() {
    if (!currentParsed) return;
    try {
      const deviceId = await getDeviceId();
      if (!deviceId) return;
      const p = await SWB_API(`/products/${encodeURIComponent(currentParsed.productID)}?device_id=${encodeURIComponent(deviceId)}`);
      currentWatched = !!p.is_watched;
      currentTargetPrice = p.target_price ? Number(p.target_price) : null; // v0.9.2
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
        currentTargetPrice = null; // v0.9.2
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

  // v0.9.2 — 가격 추이 목표가 저장/해제
  function parseTargetPrice(value) {
    const v = parseInt(String(value || "").replace(/[^0-9]/g, ""), 10);
    if (!v || v < 1000 || v > 100000000) return null;
    return v;
  }

  async function saveTargetPrice() {
    const deviceId = await getDeviceId();
    const pid = encodeURIComponent(currentParsed.productID);
    const input = shadow.querySelector(".swb-target-input");
    const target = parseTargetPrice(input ? input.value : "");
    if (!deviceId || !pid || !currentWatched) return;
    try {
      await SWB_API(`/devices/${encodeURIComponent(deviceId)}/watches/${pid}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(target ? { target_price: target } : {}),
      });
      currentTargetPrice = target;
      updateWatchBtn();
    } catch {
      // E-EXT-NET-1001
    }
  }

  async function clearTargetPrice() {
    if (!currentTargetPrice) return;
    const deviceId = await getDeviceId();
    const pid = encodeURIComponent(currentParsed.productID);
    try {
      await SWB_API(`/devices/${encodeURIComponent(deviceId)}/watches/${pid}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      currentTargetPrice = null;
      updateWatchBtn();
    } catch {
      // E-EXT-NET-1001
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
    currentTargetPrice = null; // v0.9.2
    updateWatchBtn();
try {
      const deviceId = await getDeviceId();
      const [product, points, stats] = await Promise.all([
        SWB_API(`/products/${pid}${deviceId ? `?device_id=${encodeURIComponent(deviceId)}${variantQS}` : ""}`).catch(() => null),
        SWB_API(`/products/${pid}/prices?limit=200${variantQS}`).catch(() => []),
        SWB_API(`/products/${pid}/stats${variantQS}`).catch(() => null), // v0.10.0
      ]);
      pointsCache = points || [];
      trendStatsCache = stats || null;
      if (product) {
        if (!nowPriceCache && product.last_price) nowPriceCache = Number(product.last_price);
        if (product.is_watched) currentWatched = true;
        currentTargetPrice = product.target_price ? Number(product.target_price) : null; // v0.9.2
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
    // Phase 3 (v0.9.0): 함께 본 상품 — 관계 그래프 조회 (조회 중 로딩 표시, 없으면 숨김)
    const relBox = panel.querySelector(".swb-related");
    const relList = relBox.querySelector(".swb-rel-list");
    relBox.classList.remove("hidden");
    relList.innerHTML = `<div class="swb-rel-loading">로딩중…</div>`;
    try {
      const related = await SWB_API(`/products/${pid}/related?limit=5`).catch(() => []);
      if (Array.isArray(related) && related.length) {
        renderRelated(related);
      } else {
        relBox.classList.add("hidden"); // 관계 데이터 없음 — 섹션 숨김
      }
    } catch {
      relBox.classList.add("hidden"); // 관계 조회 실패 — 조용히 숨김
    }
  }

  // Phase 3 (v0.9.0): 함께 본 상품 목록 렌더 — 클릭 시 새 탭 오픈
  function renderRelated(items) {
    const relBox = shadow.querySelector(".swb-related");
    const relList = shadow.querySelector(".swb-rel-list");
    relList.innerHTML = "";
    for (const r of items) {
      if (!r.url) continue;
      const row = document.createElement("div");
      row.className = "swb-rel-li";
      row.innerHTML = `<span class="swb-rel-name"></span><span class="swb-rel-price"></span>`;
      row.querySelector(".swb-rel-name").textContent = r.name || r.product_id;
      row.querySelector(".swb-rel-price").textContent =
        r.last_price != null ? `${Number(r.last_price).toLocaleString()}원` : "";
      row.addEventListener("click", () => {
        if (r.url) chrome.runtime.sendMessage({ type: "OPEN_TAB", url: r.url });
      });
      relList.appendChild(row);
    }
    relBox.classList.remove("hidden");
  }

  // 일별 시리즈: 기간(일) 내 실제 기록일만 {t(ms), price}[]로 반환 (결측 보간 없음 — v0.12.0).
  // 2일 기록이면 2포인트로 정직하게 렌더링. 오늘은 페이지 현재 가격(nowPrice) 우선 병합.
  function dailySeries(points, days, nowPrice) {
    const today = new Date();
    const keyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const start = new Date(today);
    start.setDate(today.getDate() - (days - 1));
    const startKey = keyOf(start);
    const byDay = {};
    (points || []).forEach((pt) => {
      const d = new Date(pt.captured_at);
      if (isNaN(d)) return;
      const k = keyOf(d);
      if (k < startKey) return; // 기간 밖 제외
      byDay[k] = { t: d.getTime(), price: Number(pt.price) };
    });
    if (nowPrice) {
      const k = keyOf(today);
      if (k >= startKey) byDay[k] = { t: today.getTime(), price: nowPrice };
    }
    const arr = Object.keys(byDay).sort().map((k) => byDay[k]);
    return { points: arr, recordDays: arr.length };
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

    const { points, recordDays } = dailySeries(pointsCache, rangeDays, nowPriceCache);
    drawChart(canvas, points);

    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - (rangeDays - 1));
    const fmt = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
    xStart.textContent = `${fmt(start)} ~`;
    xEnd.textContent = `오늘 ${fmt(today)}`;

    const nowPrice = nowPriceCache;
    nowEl.textContent = nowPrice != null ? `${nowPrice.toLocaleString()}원` : "—";
    const first = points.length ? points[0].price : null;
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

    const valid = points.map((p) => p.price);
    if (valid.length) {
      stMin.textContent = `${Math.min(...valid).toLocaleString()}원`;
      stMax.textContent = `${Math.max(...valid).toLocaleString()}원`;
    } else {
      stMin.textContent = "—";
      stMax.textContent = "—";
    }
    stCount.textContent = String(recordDays);

    renderDealBadge(panel, nowPrice);

    renderTrendStats(panel);

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
  // 가격 통계 요약 (v0.10.0) — 7일/30일/역대 최저가·평균을 1줄 배너로
  function renderTrendStats(panel) {
    const el = panel.querySelector(".swb-trend-stats");
    if (!el) return;
    el.classList.add("hidden");
    const s = trendStatsCache;
    if (!s) return;
    const parts = [];
    const fmt = (v) => (v == null ? null : `${Number(v).toLocaleString()}원`);
    const fmtDate = (d) => (d ? d.slice(2).replace(/-/g, "/") : null);
    if (s.period7 && s.period7.min != null) parts.push(`7일 최저 ${fmt(s.period7.min)}`);
    if (s.period30 && s.period30.avg != null) parts.push(`30일 평균 ${fmt(s.period30.avg)}`);
    if (s.overall && s.overall.min != null) {
      const d = fmtDate(s.overall.min_date);
      parts.push(`역대 최저 ${fmt(s.overall.min)}${d ? ` (${d})` : ""}`);
    }
    if (!parts.length) return;
    el.textContent = parts.join(" · ");
    el.classList.remove("hidden");
  }

  function renderDealBadge(panel, nowPrice) {    const deal = panel.querySelector(".swb-deal");
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
      deal.textContent = "역대 최저가";
    } else if (cur < avg) {
      const pct = (((avg - cur) / avg) * 100).toFixed(1);
      deal.className = "swb-deal hot";
      deal.textContent = `평균보다 ${pct}% 저렴`;
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
      deals = await SWB_API(`/deals/public?limit=5&days=${dealDaysView}`);
    } catch {
      box.innerHTML = `<div class="swb-error">서버에 연결할 수 없습니다 (E-EXT-NET-1001)</div>`;
      return;
    }
    if (!deals.length) {
      box.innerHTML = `<div class="swb-empty">아직 전체 핫딜이 없습니다.<br>쇼핑을 하면 자동으로 쌓여요!</div>`;
      return;
    }
    box.innerHTML = "";
    for (const d of deals) {
      const m = mallMeta[d.mall] || null;
      const img = d.image ? ` style="background-image:url('${String(d.image).replace(/'/g, "\\'")}')"` : "";
      const badge = m ? `<em class="swb-li-badge ${m.cls}"><img src="${m.icon}" alt="${m.label}"></em>` : "";
      const watcher = `<span class="swb-deal-watch">👀 ${d.watchers || 0}명이 찜</span>`;
      const row = document.createElement("div");
      row.className = "swb-deal-li";
      row.innerHTML = `
        <span class="swb-li-thumb"${img}>${d.image ? "" : (m ? "" : "?")}${badge}</span>
        <span class="swb-deal-body">
          <span class="swb-deal-name"></span>
          <span class="swb-deal-price"></span>
          <span class="swb-deal-meta">${watcher}</span>
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
      // v0.9.1 — 알림 타입별 배지 (price_dropped | target_reached | sold_out)
      const typeMeta = {
        target_reached: { label: "목표 도달", cls: "t-target" },
        sold_out: { label: "품절", cls: "t-soldout" },
        price_dropped: { label: "▼ 하락", cls: "t-drop" },
      }[a.alert_type] || { label: "▼ 하락", cls: "t-drop" };
      const row = document.createElement("div");
      row.className = "swb-alert-li";
      row.innerHTML = `
        <span class="swb-li-thumb"${img}>${a.image ? "" : (m ? "" : "?")}${badge}</span>
        <span class="swb-alert-badge ${typeMeta.cls}">${typeMeta.label}</span>
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
      const priceText =
        a.alert_type === "sold_out" ? "재입고 알림 대기" :
        a.alert_type === "target_reached" && a.previous_price != null ? `${Number(a.previous_price).toLocaleString()}원 → ${Number(a.price).toLocaleString()}원` :
        `${Number(a.price).toLocaleString()}원`;
      row.querySelector(".swb-alert-meta").textContent = `${priceText} · ${ts}`;
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
          <span class="swb-li-price-row">
            <span class="swb-li-price"></span>
            <span class="swb-li-check"></span>
          </span>
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
      // v0.9.1 — 품절/목표가 상태 (품절 우선)
      if (w.sold_out) {
        chkEl.textContent = "품절";
        chkEl.classList.add("sold-out");
        row.classList.add("sold-out");
      } else if (w.target_price) {
        const tp = Number(w.target_price);
        const cur = w.last_price != null ? Number(w.last_price) : null;
        chkEl.textContent = `${tp.toLocaleString()}원 이하 알림${cur != null && cur <= tp ? " · 도달!" : ""}`;
        chkEl.classList.add("target");
      }
      if (chk && !w.sold_out) {
        chkEl.textContent += chkEl.textContent ? ` · ${chk.text}` : chk.text;
        chkEl.classList.add("stale");
        row.classList.add("stale"); // v0.9.2 — 행 배경
      }
      row.querySelector(".swb-li-del").addEventListener("click", (e) => {
        e.stopPropagation();
        const label = (w.product_name || w.product_id).slice(0, 20);
        confirmDialog(`'${label}…' 찜을 삭제할까요?`, async () => {
          await deleteWatch(w.product_id);
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

  async function deleteWatch(productId) {
    const deviceId = await getDeviceId();
    if (!deviceId || !productId) return;
    try {
      await SWB_API(`/devices/${encodeURIComponent(deviceId)}/watches/${encodeURIComponent(productId)}`, {
        method: "DELETE",
      });
    } catch {
      // E-EXT-NET-1001 — 목록 새로고침 시 재시도 가능
    }
  }

  // v0.12.0 — 가격 추이 그래프 전면 재설계
  //  - 실제 날짜 스케일 X축 (기록일 min~max 시간 범위 매핑, 하단 날짜 라벨)
  //  - Y축 데이터 range의 상하 10% 버퍼 + pad → 최대값이 꼭대기에 안 붙음
  //  - min==max(동일가격) → 캔버스 중앙 단일 점 + "변동 없음" (하단 납작 방지)
  //  - 그리드 3줄 + 평균점선 + 최저점선 + DPR 선명도
  function drawChart(canvas, points) {
    const dpr = window.devicePixelRatio || 1;
    const w = 292;
    const h = 140;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    points = points.filter((p) => p && typeof p.price === "number");
    if (!points.length) {
      ctx.fillStyle = "#aaa";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("기록 없음", w / 2, h / 2);
      return;
    }
    points.sort((a, b) => a.t - b.t);

    const padL = 8, padR = 8, padT = 18, padB = 20;
    const prices = points.map((p) => p.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;

    // Y축 — 상단 30px / 하단 32px 고정 여유 + 데이터 range의 8% 값 여유.
    // 최대값이 꼭대기·하단에 안 붙도록 값이 캔버스 세로 중앙부에 여유 있게 배치 (v0.12.0)
    const plotTop = padT + 12;
    const plotB = h - padB - 12;
    const valTop = max + range * 0.08;
    const valBot = Math.max(0, min - range * 0.08);
    const yOf = (p) => plotTop + ((valTop - p) / (valTop - valBot)) * (plotB - plotTop);

    const first = points[0];
    const last = points[points.length - 1];
    const fmtDate = (t) => `${new Date(t).getMonth() + 1}/${new Date(t).getDate()}`;

    // 단일 기록 — 하단 납작 방지, 중앙 배치 + "변동 없음"
    if (points.length === 1) {
      const cx = w / 2, cy = h / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#2d4ae0";
      ctx.fill();
      ctx.fillStyle = "#555";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("변동 없음", cx, cy - 12);
      ctx.fillText(`${first.price.toLocaleString()}원`, cx, cy + 18);
      ctx.fillStyle = "#aaa";
      ctx.font = "9px sans-serif";
      ctx.fillText(fmtDate(first.t), cx, h - 6);
      return;
    }

    // 그리드 (min/mid/max — 점선)
    ctx.strokeStyle = "#eceff3";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    [min, (min + max) / 2, max].forEach((v) => {
      const y = yOf(v);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // X축 — 기록일 실제 시간 범위 매핑
    const t0 = first.t, t1 = last.t;
    const xOf = (t) => (t1 === t0 ? w / 2 : padL + ((t - t0) / (t1 - t0)) * (w - padL - padR));

    // 평균선 (회색 점선)
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    ctx.strokeStyle = "#c8cdd5";
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(padL, yOf(avg));
    ctx.lineTo(w - padR, yOf(avg));
    ctx.stroke();
    ctx.setLineDash([]);

    // 최저선 (파란 점선 + 라벨) — v0.9.1 유지
    if (min !== max) {
      const yMin = yOf(min);
      ctx.strokeStyle = "#4dabf7";
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(padL, yMin);
      ctx.lineTo(w - padR, yMin);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#4dabf7";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`최저 ${min.toLocaleString()}원`, padL, Math.max(10, yMin - 4));
    }

    // 선 — 하락 구간 파란 굵은 선, 상승/평탄 구간 회색 얇은 선 (v0.9.1 유지)
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const down = b.price < a.price;
      ctx.strokeStyle = down ? "#2d4ae0" : "#c8cdd5";
      ctx.lineWidth = down ? 2.2 : 1.4;
      ctx.beginPath();
      ctx.moveTo(xOf(a.t), yOf(a.price));
      ctx.lineTo(xOf(b.t), yOf(b.price));
      ctx.stroke();
    }

    // 데이터 포인트 점
    ctx.fillStyle = "#2d4ae0";
    points.forEach((p) => {
      ctx.beginPath();
      ctx.arc(xOf(p.t), yOf(p.price), 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // 최저/최고 마커 — 좌표가 겹치면 회색 1점 (v0.12.0 겹침 방지)
    const minIdx = prices.indexOf(min);
    const maxIdx = prices.indexOf(max);
    const mx = xOf(points[minIdx].t);
    const my = yOf(min);
    const hx = xOf(points[maxIdx].t);
    const hy = yOf(max);
    if (Math.abs(mx - hx) < 6 && Math.abs(my - hy) < 6) {
      ctx.beginPath();
      ctx.arc(mx, my, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "#8a8f98";
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(mx, my, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "#4dabf7";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(hx, hy, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "#e5484d";
      ctx.fill();
    }

    // 가격 라벨 — 우상단 마지막 가격
    ctx.font = "11px sans-serif";
    ctx.textAlign = "right";
    ctx.fillStyle = "#555";
    ctx.fillText(`${last.price.toLocaleString()}원`, w - padR, 12);

    // 날짜 라벨 — 하단 양쪽 (첫/마지막 기록일)
    ctx.fillStyle = "#aaa";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(fmtDate(first.t), padL, h - 6);
    ctx.textAlign = "right";
    ctx.fillText(fmtDate(last.t), w - padR, h - 6);
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
      syncDebugMenu(); // v0.9.4 — 메뉴 생성 후에도 debug 아이콘 동기화 (onChanged 실시간 반영)
    },
  };
})();

// v0.9.4 — debugEnabled 토글 시 플로팅 메뉴에 디버그 아이콘 실시간 반영 (옵션 전환 즉시)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.debugEnabled) return;
  if (document.querySelector("#swb-root")) SWB_UI.refresh();
});

// 페이지 로드 시 + SPA 라우팅 대비 URL 감시 (2초 주기, location 비교만 — 비용 무시 가능)
SWB_UI.refresh();
let lastHref = location.href;
setInterval(() => {
  if (location.href !== lastHref) {
    lastHref = location.href;
    SWB_UI.refresh();
  }
}, 2000);

// v0.9.4 — debugEnabled 토글 시 플로팅 메뉴에 디버그 아이콘 실시간 반영 (옵션 전환 즉시)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.debugEnabled) return;
  localStorageDebug = !!changes.debugEnabled.newValue;
  if (!document.querySelector("#swb-root")) return;
  SWB_UI.refresh();
});
