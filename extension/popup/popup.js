// popup.js — 찜 목록 + 현재 상품 찜/목표가 + 가격 추이 그래프
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
      '<li class="alert-empty">알림 내역이 없습니다.<br>가격이 내려가거나 목표가에 도달하면 여기에 표시됩니다.</li>';
  } else {
    for (const a of alerts) {
      const dropped = a.alert_type === "price_dropped";
      const d = new Date(a.created_at);
      const ts = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      const li = document.createElement("li");
      li.className = "alert-item";
      li.innerHTML = `
        <span class="alert-thumb"${a.image ? ` style="background-image:url('${String(a.image).replace(/'/g, "\\'")}')"` : ""}></span>
        <span class="alert-badge ${dropped ? "drop" : "target"}">${dropped ? "▼ 하락" : "목표가 도달"}</span>
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
  current.targetPrice = null;

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
      current.targetPrice = product.target_price;
    }
  } catch (e) {
    if (e.status !== 404) return;
  }
  $("currentName").textContent =
    liveTitle || (await fetchProductName(parsed.productID)) || `${mallLabel(parsed.mall)} 상품`;
  $("currentActions").classList.remove("hidden");
  $("targetInput").value = current.targetPrice || "";
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
      $("targetInput").value = "";
    } else {
      const target = parseInt($("targetInput").value, 10) || null;
      await api(`/devices/${deviceId}/watches/${encodeURIComponent(current.productID)}`, {
        method: "PUT",
        body: JSON.stringify({ target_price: target }),
      });
      currentWatched = true;
    }
    updateWatchBtn();
    loadList();
  } catch (e) {
    setStatus("저장 실패 — 서버 연결 확인");
  }
});

$("targetInput").addEventListener("change", async () => {
  if (!currentWatched || !current) return;
  const deviceId = await getDeviceId();
  const target = parseInt($("targetInput").value, 10) || null;
  try {
    await api(`/devices/${deviceId}/watches/${encodeURIComponent(current.productID)}`, {
      method: "PUT",
      body: JSON.stringify({ target_price: target }),
    });
    setStatus("목표가 저장됨");
    loadList();
  } catch {
    setStatus("저장 실패");
  }
});

// ── 찜 목록 ─────────────────────────────────────────────
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

  const items = await Promise.all(
    watches.map(async (w) => {
      try {
        const p = await api(`/products/${encodeURIComponent(w.product_id)}`);
        return { w, p };
      } catch {
        return { w, p: null };
      }
    })
  );
  for (const { w, p } of items) {
    const li = document.createElement("li");
    li.className = "watch-item";

    const thumb = document.createElement("div");
    thumb.className = "watch-thumb";
    if (p && p.image) thumb.style.backgroundImage = `url('${p.image}')`;

    const body = document.createElement("div");
    body.className = "watch-body";
    const name = document.createElement("div");
    name.className = "watch-name";
    name.textContent = (p && p.name) || w.product_id;
    const price = document.createElement("div");
    price.className = "watch-price";
    price.textContent = p && p.last_price ? `${p.last_price.toLocaleString()}원` : "가격 없음";
    const target = document.createElement("div");
    target.className = "watch-target";
    target.textContent = w.target_price ? `목표가 ${w.target_price.toLocaleString()}원` : "";
    body.append(name, price, target);

    const removeBtn = document.createElement("button");
    removeBtn.className = "watch-unwatch";
    removeBtn.textContent = "✕";
    removeBtn.title = "찜 해제";
    removeBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await api(`/devices/${deviceId}/watches/${encodeURIComponent(w.product_id)}`, {
        method: "DELETE",
      });
      loadList();
    });

    li.append(thumb, body, removeBtn);
    li.addEventListener("click", () => showDetail(w.product_id, p));
    $("watchList").append(li);
  }
}

// ── 가격 추이 ───────────────────────────────────────────
let detailProductId = null;

async function showDetail(productId, cachedProduct) {
  detailProductId = productId;
  $("listSection").classList.add("hidden");
  $("current").classList.add("hidden");
  $("alerts").classList.add("hidden");
  $("detail").classList.remove("hidden");
  $("detailInfo").textContent = "";
  try {
    const p =
      cachedProduct ||
      (await api(`/products/${encodeURIComponent(productId)}`)) ||
      {};
    $("detailInfo").textContent = `${p.name || productId} · 최근 ${
      p.last_price ? `${p.last_price.toLocaleString()}원` : "없음"
    }`;
    const points = await api(`/products/${encodeURIComponent(productId)}/prices?limit=100`);
    drawChart(points || []);
  } catch {
    $("detailInfo").textContent = "추이를 불러오지 못했습니다";
  }
}

function drawChart(points) {
  const canvas = $("chart");
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (points.length < 1) return;

  const prices = points.map((pt) => Number(pt.price));
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const pad = 8;

  ctx.strokeStyle = "#2d4ae0";
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((pt, i) => {
    const x = pad + (i / Math.max(points.length - 1, 1)) * (w - pad * 2);
    const y = h - pad - ((Number(pt.price) - min) / range) * (h - pad * 2);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  const last = points[points.length - 1];
  const first = points[0];
  ctx.fillStyle = "#888";
  ctx.font = "11px sans-serif";
  ctx.fillText(`${first.price.toLocaleString()}원`, pad, h - 3);
  ctx.textAlign = "right";
  ctx.fillText(`${last.price.toLocaleString()}원`, w - pad, 12);
}

$("backBtn").addEventListener("click", () => {
  $("detail").classList.add("hidden");
  $("current").classList.remove("hidden");
  $("listSection").classList.remove("hidden");
  loadHistory();
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
