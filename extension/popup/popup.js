// popup.js — 알림 내역 + 현재 상품 찜 + 찜 목록
// PLATFORM: extension

const CONFIG = SWB_CONFIG; // common.js 공용 (서버 주소 단일 관리)

const $ = (id) => document.getElementById(id);

async function api(path, options = {}) {
  const res = await fetch(`${CONFIG.server}${CONFIG.api}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (res.status === 404) throw Object.assign(new Error("NOT_FOUND"), { status: 404 });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.status === 204 ? null : res.json();
}

async function getDeviceId() {
  const stored = await chrome.storage.local.get("deviceId");
  return stored.deviceId || null;
}

async function currentTabProduct() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return { tab, parsed: tab ? MallParser.parse(tab.url || "") : null };
}

// ── 알림 내역 (최상단) ───────────────────────────────────
async function loadHistory() {
  const section = $("alerts");
  section.classList.add("hidden");
  const deviceId = await getDeviceId();
  if (!deviceId) return;

  let alerts = [];
  try {
    alerts = await api(`/devices/${deviceId}/alerts/history`);
  } catch {
    return;
  }

  const listEl = $("alertList");
  listEl.innerHTML = "";
  if (!alerts.length) {
    listEl.innerHTML =
      '<li class="alert-empty">알림 내역이 없습니다.<br>찜한 상품의 가격이 내려가면 여기에 표시됩니다.</li>';
  } else {
    for (const a of alerts) {
      const d = new Date(a.created_at);
      const ts = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      const li = document.createElement("li");
      li.className = "alert-item";
      const m = mallMeta[a.mall] || null;
      li.innerHTML = `
        <span class="alert-thumb"${a.image ? ` style="background-image:url('${String(a.image).replace(/'/g, "\\'")}')"` : ""}>${a.image ? "" : (m ? m.label.slice(0, 1) : "?")}${m ? `<em class="watch-badge ${m.cls}">${m.label}</em>` : ""}</span>
        <span class="alert-badge drop">▼ 하락</span>
        <span class="alert-body">
          <span class="alert-name"></span>
          <span class="alert-meta"></span>
        </span>
        <button class="alert-del" title="삭제">✕</button>`;
      li.querySelector(".alert-name").textContent = a.product_name || a.product_id;
      li.querySelector(".alert-meta").textContent = `${Number(a.price).toLocaleString()}원 · ${ts}`;
      li.querySelector(".alert-del").addEventListener("click", async (e) => {
        e.stopPropagation();
        try {
          await api(`/devices/${deviceId}/alerts/${a.id}`, { method: "DELETE" });
        } catch {}
        loadHistory();
      });
      if (a.url) li.addEventListener("click", () => chrome.tabs.create({ url: a.url }));
      listEl.appendChild(li);
    }
  }
  section.classList.remove("hidden");
}

// ── 현재 상품 섹션 ──────────────────────────────────────
let current = null; // { parsed, product }
let currentWatched = false;

async function loadCurrent() {
  const { tab, parsed } = await currentTabProduct();
  $("currentActions").classList.add("hidden");
  if (!parsed) {
    $("currentName").textContent = "지원 상품 페이지를 열어주세요";
    return;
  }
  current = parsed;
  currentWatched = false;

  // 현재 탭에서 직접 추출 (og:title 등)
  let liveTitle = null;
  try {
    const msg = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT" });
    if (msg && msg.ok && msg.data && msg.data.title) liveTitle = msg.data.title;
  } catch {}

  const deviceId = await getDeviceId();
  try {
    const product = await api(`/products/${encodeURIComponent(parsed.productID)}?device_id=${deviceId}`);
    if (product) {
      currentWatched = product.is_watched;
    }
  } catch (e) {
    if (e.status !== 404) return;
  }
  $("currentName").textContent =
    liveTitle || (await fetchProductName(parsed.productID)) || `${mallLabel(parsed.mall)} 상품`;
  $("currentActions").classList.remove("hidden");
  updateWatchBtn();
}

function mallLabel(mall) {
  return { naver: "네이버", coupang: "쿠팡", oliveyoung: "올리브영" }[mall] || mall;
}

async function fetchProductName(productId) {
  try {
    const p = await api(`/products/${encodeURIComponent(productId)}`);
    return p && p.name;
  } catch {
    return null;
  }
}

function updateWatchBtn() {
  const btn = $("watchBtn");
  if (currentWatched) {
    btn.textContent = "찜 해제";
    btn.classList.add("active");
  } else {
    btn.textContent = "찜하기";
    btn.classList.remove("active");
  }
}

$("watchBtn").addEventListener("click", async () => {
  const deviceId = await getDeviceId();
  if (!deviceId || !current) return;
  try {
    if (currentWatched) {
      await api(`/devices/${deviceId}/watches/${encodeURIComponent(current.productID)}`, {
        method: "DELETE",
      });
      currentWatched = false;
    } else {
      await api(`/devices/${deviceId}/watches/${encodeURIComponent(current.productID)}`, {
        method: "PUT",
        body: JSON.stringify({}),
      });
      currentWatched = true;
    }
    updateWatchBtn();
    loadList();
  } catch (e) {
    setStatus("저장 실패 — 서버 연결 확인");
  }
});

// ── 찜 목록 ─────────────────────────────────────────────
const mallMeta = {
  naver: { label: "네이버", cls: "b-naver" },
  coupang: { label: "쿠팡", cls: "b-coupang" },
  oliveyoung: { label: "올영", cls: "b-oliveyoung" },
};

async function loadList() {
  const deviceId = await getDeviceId();
  $("watchList").innerHTML = "";
  if (!deviceId) {
    $("emptyMsg").classList.remove("hidden");
    return;
  }
  let watches;
  try {
    watches = await api(`/devices/${deviceId}/watches`);
  } catch {
    setStatus("서버 연결 실패");
    $("emptyMsg").classList.remove("hidden");
    return;
  }
  if (!watches.length) {
    $("emptyMsg").classList.remove("hidden");
    return;
  }
  $("emptyMsg").classList.add("hidden");

  for (const w of watches) {
    const m = mallMeta[w.mall] || null;
    const li = document.createElement("li");
    li.className = "watch-item";
    li.innerHTML = `
      <span class="watch-thumb"${w.image ? ` style="background-image:url('${String(w.image).replace(/'/g, "\\'")}')"` : ""}>${w.image ? "" : (m ? m.label.slice(0, 1) : "?")}${m ? `<em class="watch-badge ${m.cls}">${m.label}</em>` : ""}</span>
      <span class="watch-body">
        <span class="watch-name"></span>
        <span class="watch-price"></span>
      </span>
      <button class="watch-unwatch" title="찜 삭제">✕</button>`;
    li.querySelector(".watch-name").textContent = w.product_name || w.product_id;
    li.querySelector(".watch-price").textContent =
      w.last_price != null ? `${Number(w.last_price).toLocaleString()}원` : "";
    li.querySelector(".watch-unwatch").addEventListener("click", (e) => {
      e.stopPropagation();
      const label = (w.product_name || w.product_id).slice(0, 20);
      confirmDialog(`'${label}…' 찜을 삭제할까요?`, async () => {
        try {
          await api(`/devices/${deviceId}/watches/${encodeURIComponent(w.product_id)}`, {
            method: "DELETE",
          });
        } catch {
          setStatus("삭제 실패 — 서버 연결 확인");
        }
        loadList();
      });
    });
    li.addEventListener("click", () => {
      if (w.url) chrome.tabs.create({ url: w.url });
    });
    $("watchList").append(li);
  }
}

// ── 컨펌 다이얼로그 (플로팅 찜 목록과 동일 동작) ──────────
let confirmCallback = null;

function confirmDialog(message, onConfirm) {
  $("confirmMsg").textContent = message;
  confirmCallback = onConfirm;
  $("confirmDlg").classList.remove("hidden");
}

$("confirmNo").addEventListener("click", () => {
  confirmCallback = null;
  $("confirmDlg").classList.add("hidden");
});
$("confirmYes").addEventListener("click", () => {
  const cb = confirmCallback;
  confirmCallback = null;
  $("confirmDlg").classList.add("hidden");
  if (cb) cb();
});

// ── 공통 ────────────────────────────────────────────────
function setStatus(text) {
  $("status").textContent = text;
  setTimeout(() => ($("status").textContent = ""), 2500);
}

(async function init() {
  try {
    await loadCurrent();
  } catch {}
  await loadHistory();
  await loadList();
})();
