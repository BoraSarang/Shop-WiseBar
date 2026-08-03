// background.js — 기기ID 관리 + 탭 감시 수집 + 알림 폴링 (Chrome MV3 서비스 워커)
// PLATFORM: extension
// 수집 우선순위: 서버 크롤러(올리브영) → 익스텐션(전 몰) ← 본 파일
importScripts("common.js");

const CONFIG = {
  ...SWB_CONFIG,
  captureCooldownMs: 10 * 60 * 1000, // 동일 상품 재수집 쿨다운 (10분)
  alertPollMinutes: 5, // 알림 폴링 주기
};

async function api(path, options = {}) {
  const res = await fetch(`${CONFIG.server}${CONFIG.api}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (!res.ok) {
    let detail = null;
    try {
      detail = await res.json();
    } catch {}
    throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status, detail });
  }
  return res.status === 204 ? null : res.json();
}

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
    console.warn("[똑바] 기기 등록 실패", e);
  }
  return deviceId;
}

// ── 수집 파이프라인 ─────────────────────────────────────
async function captureProduct(tab) {
  if (!tab || !tab.url || !tab.id) return;
  const parsed = MallParser.parse(tab.url);
  if (!parsed) return;

  const { lastCapture } = await chrome.storage.local.get("lastCapture");
  if (
    lastCapture &&
    lastCapture.productID === parsed.productID &&
    Date.now() - lastCapture.at < CONFIG.captureCooldownMs
  ) {
    return;
  }

  let response;
  try {
    response = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT" });
  } catch {
    return; // content script 미로드 (리다이렉트/중간 페이지)
  }
  if (!response || !response.ok || !response.data) return;

  const { parsed: target, data } = response;
  const price = Number(data.price);
  if (!price || price <= 0) return;

  try {
    await api("/products", {
      method: "POST",
      body: JSON.stringify({
        product_id: target.productID,
        mall: target.mall,
        url: target.url,
        name: data.title,
        image: data.image,
      }),
    });
    await api(`/products/${encodeURIComponent(target.productID)}/prices`, {
      method: "POST",
      body: JSON.stringify({ price, source: "extension" }),
    });
    await chrome.storage.local.set({
      lastCapture: { productID: target.productID, at: Date.now() },
    });
    console.log(`[똑바] 수집 완료 ${target.productID} ${price.toLocaleString()}원`);
  } catch (e) {
    console.warn("[똑바] 업로드 실패 (다음 방문 시 재시도)", e);
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  captureProduct(tab);
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (tab) captureProduct(tab);
});

// ── 알림 폴링 (서버 alerts → chrome.notifications) ──────
async function pollAlerts() {
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

  for (const alert of alerts) {
    const notificationId = `swb-${Date.now()}-${alert.product_id}`;
    const title =
      alert.alert_type === "target_reached" ? "목표가에 도달했습니다" : "가격이 내려갔습니다";
    const message = `${alert.product_id} · ${Number(alert.price).toLocaleString()}원${
      alert.previous_price != null
        ? ` (기존 ${Number(alert.previous_price).toLocaleString()}원)`
        : ""
    }`;
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

// ── content script → 새 탭 열기 브리지 (찜 목록 관리) ────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "OPEN_TAB" && msg.url) {
    chrome.tabs.create({ url: msg.url });
    sendResponse({ ok: true });
    return true;
  }
});

chrome.runtime.onInstalled.addListener(init);
chrome.runtime.onStartup.addListener(init);
