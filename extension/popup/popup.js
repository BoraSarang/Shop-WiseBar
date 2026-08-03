// popup.js — 알림 내역 + 현재 상품 찜 + 찜 목록
// PLATFORM: extension

const CONFIG = SWB_CONFIG; // common.js 공용 (서버 주소 단일 관리)

const $ = (id) => document.getElementById(id);

async function api(path, options = {}) {
  return SWB_API(path, options);
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
        <span class="alert-thumb"${a.image ? ` style="background-image:url('${String(a.image).replace(/'/g, "\\'")}')"` : ""}>${a.image ? "" : (m ? "" : "?")}${mallBadgeHtml(m)}</span>
        <span class="alert-badge drop">▼ 하락</span>
        <span class="alert-body">
          <span class="alert-name"></span>
          <span class="alert-meta"></span>
        </span>
        <button class="alert-del" title="삭제">✕</button>`;
      const badgeImg = m ? li.querySelector(".watch-badge img") : null;
      if (badgeImg) {
        badgeImg.addEventListener("error", () => {
          badgeImg.replaceWith(document.createTextNode(m.label));
          badgeImg.parentElement.classList.add("b-fallback");
        });
      }
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
  $("currentPrice").textContent = "";
  $("dealBadge").classList.add("hidden");
  $("currentStats").textContent = "";
  if (!parsed) {
    $("currentName").textContent = "지원 몰(네이버·쿠팡·올리브영)의 상품 페이지를 열어주세요";
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
      if (product.last_price != null) {
        $("currentPrice").textContent = `${Number(product.last_price).toLocaleString()}원`;
      }
      renderStats(product);
    }
  } catch (e) {
    if (e.status !== 404) return;
  }
  $("currentName").textContent =
    liveTitle || (await fetchProductName(parsed.productID)) || `${mallLabel(parsed.mall)} 상품`;
  $("currentActions").classList.remove("hidden");
  updateWatchBtn();
}

// 지금 사도 돼 배지 + 최저가/평균가/추적자 수 (서버 통계 기반, v0.4)
// 3상태: 역대 최저가 / 평균보다 저렴 / 평균보다 비쌈 (항상 표시)
function renderStats(product) {
  const badge = $("dealBadge");
  const stats = $("currentStats");
  const parts = [];
  if (product.avg_price != null) parts.push(`평균 ${Number(product.avg_price).toLocaleString()}원`);
  if (product.min_price != null) parts.push(`최저 ${Number(product.min_price).toLocaleString()}원`);
  if (product.watch_count != null) parts.push(`${product.watch_count}명 추적`);
  stats.textContent = parts.join(" · ");

  const cur = product.last_price;
  if (cur == null || product.avg_price == null) return;
  badge.classList.remove("hidden");
  if (product.price_count != null && product.price_count < 3) {
    badge.textContent = `기록 ${product.price_count}개 · 데이터 쌓이는 중`;
    badge.className = "deal-badge warn";
    return;
  }
  const curNum = Number(cur);
  const avg = Number(product.avg_price);
  const min = product.min_price != null ? Number(product.min_price) : null;
  if (min != null && curNum <= min) {
    badge.textContent = "역대 최저가";
    badge.className = "deal-badge low";
  } else if (curNum < avg) {
    const pct = (((avg - curNum) / avg) * 100).toFixed(1);
    badge.textContent = `평균보다 ${pct}% 저렴`;
    badge.className = "deal-badge hot";
  } else if (curNum > avg) {
    const pct = (((curNum - avg) / avg) * 100).toFixed(1);
    badge.textContent = `평균보다 ${pct}% 비쌈`;
    badge.className = "deal-badge warn";
  } else {
    badge.textContent = "평균 가격 수준";
    badge.className = "deal-badge low";
  }
}

function mallLabel(mall) {
  return { naver: "네이버", coupang: "쿠팡", oliveyoung: "올리브영" }[mall] || mall;
}

// 가격 정보 갱신 배지 — 마지막 캡처로부터 오래될수록 확인 권유 (v0.4 방문 유도)
function staleCheckLabel(lastCheckedAt, opt = {}) {
  const DAY = 24 * 60 * 60 * 1000;
  if (!lastCheckedAt) return null;
  const d = new Date(lastCheckedAt);
  if (isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  if (diff < 24 * 60 * 60 * 1000) return null; // 하루 이내는 갱신 표시 생략
  const days = Math.floor(diff / DAY);
  const label = days === 0 ? "오늘" : `${days}일 전`;
  if (days >= (opt.staleDays ?? 3)) {
    return { text: `확인 필요 · ${label}`, stale: true };
  }
  return null;
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
  naver: { label: "네이버", cls: "b-naver", icon: "https://www.google.com/s2/favicons?domain=www.naver.com&sz=32" },
  coupang: { label: "쿠팡", cls: "b-coupang", icon: "https://www.google.com/s2/favicons?domain=www.coupang.com&sz=32" },
  oliveyoung: { label: "올영", cls: "b-oliveyoung", icon: "https://www.google.com/s2/favicons?domain=www.oliveyoung.co.kr&sz=32" },
};

function mallBadgeHtml(m) {
  return m ? `<em class="watch-badge ${m.cls}"><img src="${m.icon}" alt="${m.label}"></em>` : "";
}

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
      <span class="watch-thumb"${w.image ? ` style="background-image:url('${String(w.image).replace(/'/g, "\\'")}')"` : ""}>${w.image ? "" : (m ? "" : "?")}${mallBadgeHtml(m)}</span>
      <span class="watch-body">
        <span class="watch-name"></span>
        <span class="watch-price"></span>
        <span class="watch-check"></span>
      </span>
      <button class="watch-unwatch" title="찜 삭제">✕</button>`;
    const badgeImg = m ? li.querySelector(".watch-badge img") : null;
    if (badgeImg) {
      badgeImg.addEventListener("error", () => {
        badgeImg.replaceWith(document.createTextNode(m.label));
        badgeImg.parentElement.classList.add("b-fallback");
      });
    }
    li.querySelector(".watch-name").textContent = w.product_name || w.product_id;
    li.querySelector(".watch-price").textContent =
      w.last_price != null ? `${Number(w.last_price).toLocaleString()}원` : "";
    const checkEl = li.querySelector(".watch-check");
    const stale = staleCheckLabel(w.last_checked_at);
    if (stale) {
      checkEl.textContent = stale.text;
      checkEl.classList.add("stale");
      li.classList.add("stale-row");
    }
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
  $("status").textContent = "불러오는 중…";
  try {
    await loadCurrent();
  } catch {}
  await loadHistory();
  await loadList();
  $("status").textContent = "";
})();
