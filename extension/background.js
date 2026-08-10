// background.js — 기기ID 관리 + 탭 감시 수집 + 알림 폴링 (Chrome MV3 서비스 워커)
// PLATFORM: extension
// 수집 우선순위: 서버 크롤러(올리브영) → 익스텐션(전 몰) ← 본 파일
importScripts("common.js", "debug.js");

const CONFIG = {
  ...SWB_CONFIG,
  captureCooldownMs: 10 * 60 * 1000, // 동일 상품 재수집 쿨다운 (10분)
  alertPollMinutes: 5, // 알림 폴링 주기
};

async function api(path, options = {}) {
  const t0 = performance.now();
  try {
    const r = await SWB_API(path, options);
    DebugLogger.perf(`API ${path}`, performance.now() - t0);
    return r;
  } catch (e) {
    DebugLogger.warn(`API 실패 ${path}`, e);
    throw e;
  }
}

// ── 디버그 로그 (v0.9.3 디버그 창 + 중앙 storage) ─────────
const DEBUG_LOG_KEY = "debugLog";
const DEBUG_MAX = 2000; // 서비스 워커는 디바운스 없이 즉시 기록 (비동기 1회/로그)

// content script가 위임한 로그에 sender.tab(탭ID/url/몰) 태깅 후 중앙 storage에 추가
// debugEnabled는 저장 시점에 실제로 확인 → on/off가 모든 탭에 즉시 반영 (content 캐시 불필요)
function persistDebugLog(entry, tab) {
  if (!entry || !entry.text) return;
  const e = Object.assign({}, entry, { scope: entry.scope || "content" });
  if (tab) {
    e.tabId = tab.id;
    if (!e.url) e.url = tab.url || undefined;
    if (!e.mall) {
      const pr = MallParser.parse(tab.url || "");
      e.mall = pr ? pr.mall : undefined;
    }
  }
  chrome.storage.local.get([DEBUG_LOG_KEY, "debugEnabled"], (v) => {
    if (!(v && v.debugEnabled)) return; // 로그 off면 위임분 폐기 (총 저장 비용 최소화)
    let arr = Array.isArray(v && v[DEBUG_LOG_KEY]) ? v[DEBUG_LOG_KEY] : [];
    arr = arr.concat([e]);
    arr = arr.slice(-DEBUG_MAX);
    chrome.storage.local.set({ [DEBUG_LOG_KEY]: arr });
  });
}

// 디버그 창 열기/토글 — chrome.windows.create popup 타입 (단축키/팝업 버튼 공용)
// 창이 이미 있으면 포커스만, 없으면 우상단 popup 창 생성
let _debugWinId = null;
function openDebugWindow() {
  const url = chrome.runtime.getURL("debug-view.html");
  // 이미 연 창이 있으면 포커스
  if (_debugWinId != null) {
    chrome.windows.update(_debugWinId, { focused: true }, () => {
      if (chrome.runtime.lastError) _debugWinId = null; // 창 닫힘
    });
    return;
  }
  const w = 780; // v0.9.3 — 로그 가독성 위해 1.5배(520→780)
  const h = 640;
  // 서비스 워커에는 screen 객체가 없음 — 화면 폭은 기본값 사용 (우상단 배치는 가장 가까운 창 기준)
  const availW = typeof screen !== "undefined" && screen.availWidth ? screen.availWidth : 1280;
  chrome.windows.create(
    {
      url,
      type: "popup",
      width: w,
      height: h,
      // 화면 기준 우상단 배치 (기본값 폭 기준 — 해상도 다르면 브라우저가 조정)
      left: availW - w - 24,
      top: 24,
      focused: true,
    },
    (win) => {
      if (win) _debugWinId = win.id;
      // 창 닫힘 감지 → id 초기화 (다음 토글에 새 창)
      chrome.windows.onRemoved.addListener((removedId) => {
        if (removedId === _debugWinId) _debugWinId = null;
      });
    }
  );
}

// 단축키 (manifest commands) — 디버그 창 열기/토글
chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-debug") openDebugWindow();
});

// ── 기기ID ──────────────────────────────────────────────
async function getDeviceId() {
  const stored = await chrome.storage.local.get("deviceId");
  if (stored.deviceId) return stored.deviceId;
  const deviceId = crypto.randomUUID();
  await chrome.storage.local.set({ deviceId });
  return deviceId;
}

async function ensureDeviceRegistered() {
  const deviceId = await getDeviceId();
  try {
    const device = await api("/devices", {
      method: "POST",
      body: JSON.stringify({ device_id: deviceId }),
    });
    if (device && device.device_id) await chrome.storage.local.set({ deviceId: device.device_id });
  } catch (e) {
    DebugLogger.warn("[똑바] 기기 등록 실패", e);
  }
  return deviceId;
}

// ── 수집 파이프라인 ─────────────────────────────────────
// v0.9.4 — captureProduct 동시 실행 잠금: tabs.onUpdated(complete)/onActivated/
// onHistoryStateUpdated가 거의 동시에 발생해 captureProduct가 중복 실행되면
// lastCapture 쿨다운이 비동기 storage get 경합으로 막지 못해 prices 3회 중복
// 업로드 → UNIQUE(product_id, captured_at) 500, relations 동시 POST → 500 유발.
// 인메모리 Map으로 동일 탭의 captureProduct 실행을 직렬화한다.
const _captureLocks = new Map();
async function withCaptureLock(tabId, fn) {
  if (_captureLocks.has(tabId)) return;
  const prev = _captureLocks.get(tabId) || Promise.resolve();
  let release;
  const gate = new Promise((res) => (release = res));
  _captureLocks.set(tabId, prev.then(() => gate));
  await prev;
  try {
    await fn();
  } finally {
    release();
    if (_captureLocks.get(tabId) === prev.then(() => gate)) _captureLocks.delete(tabId);
  }
}

async function captureProduct(tab) {
  if (!tab || !tab.url || !tab.id) return;
  await withCaptureLock(tab.id, async () => {
    await captureProductInner(tab);
  });
}

async function captureProductInner(tab) {
  if (!tab || !tab.url || !tab.id) return;
  const parsed = MallParser.parse(tab.url);
  if (!parsed) {
    // Phase 2 (v0.8.0): 검색/목록 페이지(상품 없음) — 카탈로그 카드 수집만
    const mall = MallParser.detectMall(tab.url);
    if (mall && mall.kind === "listing") {
      let key = `list:${tab.url}`;
      try {
        key = `list:${new URL(tab.url).pathname}`;
      } catch {
        // 파싱 실패 시 전체 URL 키 사용
      }
      await captureRelated(tab.id, key);
    }
    return;
  }

  let response;
  try {
    response = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT", url: tab.url });
  } catch {
    return; // content script 미로드 (리다이렉트/중간 페이지)
  }
  if (!response || !response.ok || !response.data) return;

  const variant = response.data.variant || null;
  const { lastCapture } = await chrome.storage.local.get("lastCapture");
  const captureKey = `${parsed.productID}:${variant || ""}`;
  if (
    lastCapture &&
    lastCapture.key === captureKey &&
    Date.now() - lastCapture.at < CONFIG.captureCooldownMs
  ) {
    return;
  }

  const { parsed: target, data } = response;
  const price = Number(data.price);
  const soldOut = Boolean(data.soldOut);
  if (!price && !soldOut) return;
  // v0.16.10 — 올리브영 goodsNo는 A+12자리 또는 B+12자리(13자)다. 관심상품 ID가 15자면
  //   상세페이지 URL이 이미지 파일명 등 잘못된 소스에서 온 것 — 오염 방지를 위해 저장 전 차단.
  //   v0.16.11 — B+12자리 상품(기획세트 등) 누락 방지: `^[AB]\d{12}$`.
  if (target.mall === "oliveyoung" && !/^[AB]\d{12}$/.test(target.productID)) {
    DebugLogger.warn(`[똑바] 올리브영 잘못된 ID 차단 ${target.productID} ([AB]+12자리 아님)`);
    return;
  }

  try {
    await api("/products", {
      method: "POST",
      body: JSON.stringify({
        product_id: target.productID,
        mall: target.mall,
        url: target.url,
        name: data.title,
        image: data.image,
        source: "detail",
      }),
    });
    if (price && price > 0) {
      await api(`/products/${encodeURIComponent(target.productID)}/prices`, {
        method: "POST",
        body: JSON.stringify({ price, source: "extension", variant }),
      });
    }
    // v0.9.1 — 품절 상태 보고 (가격 없이 품절만 감지된 페이지) — 재판매 시 가격 캡처가 자동 해제
    if (soldOut) {
      await api(`/products/${encodeURIComponent(target.productID)}/sold-out`, {
        method: "POST",
        body: JSON.stringify({ sold_out: true }),
      });
    }
    await chrome.storage.local.set({
      lastCapture: { key: captureKey, at: Date.now() },
    });
    DebugLogger.info(`[똑바] 수집 완료 ${target.productID}${variant ? " (" + variant + ")" : ""}${price ? " " + price.toLocaleString() + "원" : " (품절)"}`);
  } catch (e) {
    DebugLogger.warn("[똑바] 업로드 실패 (다음 방문 시 재시도)", e);
    return;
  }
  // 연관 상품 캡처 (v0.5) — 카탈로그 확장: 가격 없어도 상품 등록, 가격 있으면 함께 저장
  // Phase 3 (v0.9.0): parentId 전달 — 연관 카드와의 관계 그래프 저장
  await captureRelated(tab.id, captureKey, parsed.productID);
}

// ── 연관 상품 수집 (v0.5) ───────────────────────────────
// 상품 페이지의 연관/추천 섹션(함께 본 상품 등)에서 상품 카드를 수집해 카탈로그에 등록
// 가격이 노출되는 상품은 가격까지 저장 — 사용자 방문 없이도 데이터 축적
// 수집 시점: ①페이지 로드 직후 1회(현재 보이는 카드) ②사용자 스크롤로 새 카드 로드 시 (content.js가 감지)
const relatedUploadedIds = new Set(); // 세션 내 중복 업로드 방지 (content.js Set과 이중 안전망)

// ── 연관 상품 배치 전송 (v0.11.0 T-99k) ─────────────────
// ①GET /health 워밍업(콜드스타트 선차단) ②POST /products/batch(90s·재시도 2회) ③relations
// 워밍업이 실패해도 batch 재시도가 서버를 깨우므로 무시.
async function sendBatchChunk(chunk, parentId) {
  // Render 무료티어 sleep 대비 워밍업 — /health는 서버 루트에만 존재.
  // api()(SWB_API)는 항상 /api/v1 접두사를 붙여 /api/v1/health 404(NOT_FOUND WARN)가 나므로 직접 fetch (v0.12.1)
  const warm = new AbortController();
  const warmTimer = setTimeout(() => warm.abort(), 30000);
  await fetch(`${SWB_CONFIG.server}/health`, { signal: warm.signal }).catch(() => {});
  clearTimeout(warmTimer);
  const res = await api("/products/batch", {
    method: "POST",
    body: JSON.stringify({ items: chunk }),
    timeoutMs: 90000,   // Render 콜드스타트 최대 ~60s + 재시도 대기 여유 (C)
    maxAttempts: 2,     // 멱등 upsert라 재시도 허용 (B)
  });
  const relatedIds = (res?.items || []).filter((o) => o && o.product_id).map((o) => o.product_id);
  if (parentId && relatedIds.length) {
    try {
      await api("/products/relations", {
        method: "POST",
        body: JSON.stringify({ source: parentId, targets: relatedIds.slice(0, 10) }),
        timeoutMs: 60000,
        maxAttempts: 2,
      });
    } catch (e) {
      DebugLogger.warn("[똑바] 관계 저장 실패", e);
    }
  }
  return { upserted: res?.upserted || 0, relatedIds };
}

// ── 연관 상품 오프라인 큐 (v0.11.0 T-99k / AGENTS.md 8.11) ──
// 배치 POST 실패(서버 지연·SW 종료) 시 연관 카드를 storage에 보관 후, SW가 깨어날 때마다 재전송.
const PENDING_RELATED_KEY = "pendingRelated";
const PENDING_RELATED_MAX = 10; // 큐 최대 보관 건수 (초과 시 오래된 것부터 삭제)

async function queueRelated(chunk, label, parentId) {
  const { [PENDING_RELATED_KEY]: pending = [] } = await chrome.storage.local.get(PENDING_RELATED_KEY);
  pending.push({ label, parentId, items: chunk, at: Date.now() });
  while (pending.length > PENDING_RELATED_MAX) pending.shift();
  await chrome.storage.local.set({ [PENDING_RELATED_KEY]: pending });
  DebugLogger.warn(`[똑바] 연관 상품 ${chunk.length}개 오프라인 큐 보관 (총 ${pending.length}건)`);
}

// 큐 재전송 — 성공 건은 제거, 실패 건은 유지(다음 폴링에서 재시도). 큐 항목은 이미 보관본이므로 재보관 없음.
async function flushPendingRelated() {
  const { [PENDING_RELATED_KEY]: pending = [] } = await chrome.storage.local.get(PENDING_RELATED_KEY);
  if (!pending.length) return;
  const remaining = [];
  for (const job of pending) {
    try {
      const r = await sendBatchChunk(job.items, job.parentId);
      if (r.upserted > 0) {
        DebugLogger.info(`[똑바] 오프라인 큐 재전송 성공 — ${job.label} (${r.upserted}개)`);
        continue; // 성공 → 큐에서 제거
      }
    } catch (e) {
      DebugLogger.warn("[똑바] 오프라인 큐 재전송 실패 (다음 폴링 재시도)", e);
    }
    remaining.push(job);
  }
  await chrome.storage.local.set({ [PENDING_RELATED_KEY]: remaining });
}

async function uploadRelatedItems(items, label, parentId) {
  // v0.10.4 (T-93) — 일괄 업로드: 개별 /products + /prices (상품당 2요청) 대신
  // POST /products/batch 1요청에 최대 40개 묶음. 40개 카드 캡처가 80개 요청이던 것을
  // 1회로 줄여 서버 연결·라우팅 오버헤드 제거 ([PERF] 1~3s 지연의 주요 원인)
  let upserted = 0;
  const relatedIds = [];
  // v0.16.10 — 올리브영 goodsNo는 A+12자리 또는 B+12자리(13자)만 유효. 15자(이미지 파일명 오염) 제외 —
  //   존재하지 않는 ID로 저장되어 서버 크롤러가 전부 "찾을 수 없"으로 판정하던 치명적 버그 방지.
  //   v0.16.11 — B+12자리 상품(기획세트 등)도 유효 — 서버 crawlers/oliveyoung.py 규약과 일치.
  const itemsOk = items.filter(
    (it) => it.mall !== "oliveyoung" || /^[AB]\d{12}$/.test(it.productID),
  );
  const fresh = itemsOk.filter((item) => !relatedUploadedIds.has(item.productID));
  // batch는 한 번에 40개까지 (schemas max_length=50) — 초과분은 다음 요청으로
  for (let i = 0; i < fresh.length; i += 40) {
    const chunk = fresh.slice(i, i + 40).map((item) => ({
      product_id: item.productID,
      mall: item.mall,
      url: item.url,
      name: item.name,
      image: item.image,
      source: "card",
      price: item.price && item.price > 0 ? item.price : undefined,
    }));
    try {
      const r = await sendBatchChunk(chunk, null); // relations는 루프 후 일괄
      for (const id of r.relatedIds) {
        relatedUploadedIds.add(id);
        relatedIds.push(id);
      }
      upserted += r.upserted;
    } catch (e) {
      DebugLogger.warn("[똑바] 연관 상품 일괄 업로드 실패", e);
      await queueRelated(chunk, label, parentId); // (D) 오프라인 큐 보관
    }
  }
  // Phase 3 (v0.9.0): 상품 페이지 연관 카드 → 관계 그래프 저장 (목록 페이지는 parentId 없음)
  if (parentId && relatedIds.length) {
    try {
      await api("/products/relations", {
        method: "POST",
        body: JSON.stringify({ source: parentId, targets: relatedIds.slice(0, 10) }),
        timeoutMs: 60000,
        maxAttempts: 2,
      });
    } catch (e) {
      DebugLogger.warn("[똑바] 관계 저장 실패", e);
    }
  }
  if (upserted > 0) DebugLogger.info(`[똑바] 연관 상품 ${upserted}개 수집 — ${label}`);
  return upserted;
}

async function captureRelated(tabId, captureKey, parentId) {
  let res;
  try {
    res = await chrome.tabs.sendMessage(tabId, { type: "EXTRACT_RELATED" });
  } catch {
    return; // content script 미로드
  }
  if (!res || !res.ok || !Array.isArray(res.items) || !res.items.length) return;

  const { lastRelated } = await chrome.storage.local.get("lastRelated");
  if (lastRelated && lastRelated.key === captureKey && Date.now() - lastRelated.at < CONFIG.captureCooldownMs) {
    return;
  }

  await uploadRelatedItems(res.items, captureKey, parentId);
  await chrome.storage.local.set({ lastRelated: { key: captureKey, at: Date.now() } });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  captureProduct(tab);
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (tab) captureProduct(tab);
});

// ── SPA 내비게이션 수집 (v0.5.1) ─────────────────────────
// 올리브영(Vue) 등은 history.pushState로 페이지 전환 → tabs.onUpdated(complete) 미발생.
// onHistoryStateUpdated로 URL 변경을 감지하고 렌더 대기 후 수집 (captureProduct의
// 쿨다운으로 중복 자동 방지). /PLATFORM: extension, SPA/naver/coupang/oliveyoung
chrome.webNavigation.onHistoryStateUpdated.addListener(({ tabId, url }) => {
  if (!tabId || !url || !MallParser.parse(url)) return;
  chrome.tabs.get(tabId).then((tab) => {
    setTimeout(() => captureProduct(tab), 800); // SPA 렌더(가격 DOM) 대기
  }).catch(() => {});
});

// ── 알림 폴링 (서버 alerts → chrome.notifications) ──────
async function pollAlerts() {
  // v0.11.0 (T-99k) — SW가 깨어났을 때 오프라인 큐 먼저 재전송 (실패 시 유지, 다음 폴링 재시도)
  await flushPendingRelated();

  const deviceId = await getDeviceId();
  const { lastAlertAt } = await chrome.storage.local.get("lastAlertAt");
  const since = lastAlertAt ? `?since=${encodeURIComponent(lastAlertAt)}` : "";

  let alerts;
  try {
    alerts = await api(`/devices/${deviceId}/alerts${since}`);
  } catch {
    return;
  }
  if (!alerts || alerts.length === 0) return;

  const nowIso = new Date().toISOString();
  await chrome.storage.local.set({ lastAlertAt: nowIso });

  // 히스토리 저장 (실패해도 알림 표시는 계속)
  try {
    await api(`/devices/${deviceId}/alerts`, {
      method: "POST",
      body: JSON.stringify(
        alerts.map((a) => ({
          product_id: a.product_id,
          alert_type: a.alert_type,
          price: a.price,
          previous_price: a.previous_price,
        }))
      ),
    });
  } catch (e) {
    DebugLogger.warn("[똑바] 알림 히스토리 저장 실패", e);
  }

  for (const alert of alerts) {
    const notificationId = `swb-${Date.now()}-${alert.product_id}`;
    const pct =
      alert.previous_price != null && alert.previous_price > 0
        ? Math.round(((alert.previous_price - alert.price) / alert.previous_price) * 100)
        : null;
    // v0.14.0 (T-110) — 품절 복귀 알림 분기
    let title;
    let message;
    if (alert.alert_type === "back_in_stock") {
      title = "품절 해제 · 다시 살 수 있어요";
      message = `${Number(alert.price).toLocaleString()}원 · 판매 재개`;
    } else {
      title = pct != null ? `가격 ${pct}% 내려갔습니다!` : "가격이 내려갔습니다";
      message = `${Number(alert.price).toLocaleString()}원${
        pct != null ? ` (-${pct}%)` : ""
      }${alert.previous_price != null ? ` · 기존 ${Number(alert.previous_price).toLocaleString()}원` : ""}`;
    }
    await chrome.storage.session.set({ [`nid:${notificationId}`]: alert.product_id });
    chrome.notifications.create(notificationId, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon128.png"),
      title,
      message,
    });
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "alert-poll") pollAlerts();
});

chrome.notifications.onClicked.addListener(async (notificationId) => {
  chrome.notifications.clear(notificationId);
  const key = `nid:${notificationId}`;
  const stored = await chrome.storage.session.get(key);
  const productId = stored[key];
  if (productId) {
    await chrome.storage.session.remove(key);
    try {
      const product = await api(`/products/${encodeURIComponent(productId)}`);
      if (product && product.url) chrome.tabs.create({ url: product.url });
    } catch {
      // 상품 조회 실패 시 알림만 종료
    }
  }
});

// ── 초기화 ──────────────────────────────────────────────
async function init() {
  await ensureDeviceRegistered();
  const alarm = await chrome.alarms.get("alert-poll");
  if (!alarm) await chrome.alarms.create("alert-poll", { periodInMinutes: CONFIG.alertPollMinutes });
}

// ── 찜 목록 캐시 (v0.8.5 — 목록 페이지 찜 배지용) ───────
let watchCache = null;
let watchCacheAt = 0;
const WATCH_CACHE_TTL = 30 * 1000;

async function getWatchCache(force = false) {
  if (!force && watchCache && Date.now() - watchCacheAt < WATCH_CACHE_TTL) return watchCache;
  try {
    const deviceId = await getDeviceId();
    watchCache = await api(`/devices/${encodeURIComponent(deviceId)}/watches`);
    watchCacheAt = Date.now();
  } catch {
    if (!watchCache) watchCache = [];
  }
  return watchCache || [];
}

// ── content script → 새 탭 열기 / 옵션 페이지 / 스크롤 연관 수집 브리지 ──────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "OPEN_TAB" && msg.url) {
    chrome.tabs.create({ url: msg.url });
    sendResponse({ ok: true });
    return true;
  }
  if (msg && msg.type === "OPEN_OPTIONS") {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return true;
  }
  if (msg && msg.type === "WATCHES_GET") {
    getWatchCache(!!msg.force).then((watches) => sendResponse({ ok: true, watches }));
    return true;
  }
  if (msg && msg.type === "WATCHES_INVALIDATE") {
    watchCache = null;
    sendResponse({ ok: true });
    return true;
  }
  // 디버그 로그 요청 (팝업/옵션 → background 링 버퍼, v0.9.3)
  if (msg && msg.type === "DEBUG_RECENT") {
    DebugLogger.recent(Number(msg.n) || 30).then((entries) =>
      sendResponse({ ok: true, lines: entries.map((e) => DebugLogger.format(e)) })
    );
    return true;
  }
  // content script 로그 위임 (v0.9.3) — sender.tab로 탭/url/몰 태깅 후 중앙 storage 기록
  if (msg && msg.type === "DEBUG_LOG" && msg.entry) {
    persistDebugLog(msg.entry, _sender.tab || null);
    sendResponse({ ok: true });
    return true;
  }
  // 디버그 창 열기 (팝업 버튼) — 단축키와 동일 동작 (v0.9.3)
  if (msg && msg.type === "OPEN_DEBUG") {
    openDebugWindow();
    sendResponse({ ok: true });
    return true;
  }
  // 사용자 스크롤 → 새로 로드된 연관 상품 수집 (v0.5)
  // v0.9.6: parentId 포함 — 상품 페이지면 관계 그래프가 스크롤 카드에도 저장됨
  if (msg && msg.type === "RELATED_FOUND" && Array.isArray(msg.items) && msg.items.length) {
    uploadRelatedItems(msg.items, "scroll", msg.parentId || null);
    sendResponse({ ok: true });
    return true;
  }
});

chrome.runtime.onInstalled.addListener(async (details) => {
  await init();
  // 설치 직후 1회 온보딩(사용법) 페이지 오픈 — 업데이트 시에는 열지 않음
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
  }
});
chrome.runtime.onStartup.addListener(init);
