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

  let response;
  try {
    response = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT" });
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
      body: JSON.stringify({ price, source: "extension", variant }),
    });
    await chrome.storage.local.set({
      lastCapture: { key: captureKey, at: Date.now() },
    });
    console.log(`[똑바] 수집 완료 ${target.productID}${variant ? " (" + variant + ")" : ""} ${price.toLocaleString()}원`);
  } catch (e) {
    console.warn("[똑바] 업로드 실패 (다음 방문 시 재시도)", e);
    return;
  }
  // 연관 상품 캡처 (v0.5) — 카탈로그 확장: 가격 없어도 상품 등록, 가격 있으면 함께 저장
  await captureRelated(tab.id, captureKey);
}

// ── 연관 상품 수집 (v0.5) ───────────────────────────────
// 상품 페이지의 연관/추천 섹션(함께 본 상품 등)에서 상품 카드를 수집해 카탈로그에 등록
// 가격이 노출되는 상품은 가격까지 저장 — 사용자 방문 없이도 데이터 축적
// 수집 시점: ①페이지 로드 직후 1회(현재 보이는 카드) ②사용자 스크롤로 새 카드 로드 시 (content.js가 감지)
const relatedUploadedIds = new Set(); // 세션 내 중복 업로드 방지 (content.js Set과 이중 안전망)

async function uploadRelatedItems(items, label) {
  let upserted = 0;
  for (const item of items) {
    if (relatedUploadedIds.has(item.productID)) continue; // 같은 세션 중복 skip
    try {
      await api("/products", {
        method: "POST",
        body: JSON.stringify({
          product_id: item.productID,
          mall: item.mall,
          url: item.url,
          name: item.name,
          image: item.image,
        }),
      });
      if (item.price && item.price > 0) {
        await api(`/products/${encodeURIComponent(item.productID)}/prices`, {
          method: "POST",
          body: JSON.stringify({ price: item.price, source: "extension" }),
        });
      }
      relatedUploadedIds.add(item.productID);
      upserted++;
    } catch (e) {
      console.warn(`[똑바] 연관 상품 업로드 실패 ${item.productID}`, e);
    }
  }
  if (upserted > 0) console.log(`[똑바] 연관 상품 ${upserted}개 수집 — ${label}`);
  return upserted;
}

async function captureRelated(tabId, captureKey) {
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

  await uploadRelatedItems(res.items, captureKey);
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
    console.warn("[똑바] 알림 히스토리 저장 실패", e);
  }

  for (const alert of alerts) {
    const notificationId = `swb-${Date.now()}-${alert.product_id}`;
    const pct =
      alert.previous_price != null && alert.previous_price > 0
        ? Math.round(((alert.previous_price - alert.price) / alert.previous_price) * 100)
        : null;
    const title = pct != null ? `가격 ${pct}% 내려갔습니다!` : "가격이 내려갔습니다";
    const message = `${Number(alert.price).toLocaleString()}원${
      pct != null ? ` (-${pct}%)` : ""
    }${alert.previous_price != null ? ` · 기존 ${Number(alert.previous_price).toLocaleString()}원` : ""}`;
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
  // 사용자 스크롤 → 새로 로드된 연관 상품 수집 (v0.5)
  if (msg && msg.type === "RELATED_FOUND" && Array.isArray(msg.items) && msg.items.length) {
    uploadRelatedItems(msg.items, "scroll");
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
