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

// ── 연관 상품 추천 (v0.9.1 — 관계 그래프 확장) ──────────
// v0.9.0 관계 그래프 API 재사용: GET /products/{id}/related (양방향 weight 합산)
async function loadRelated() {
  const sec = $("related");
  const listEl = $("relatedList");
  if (!current) {
    sec.classList.add("hidden");
    return;
  }
  let items = null;
  try {
    const r = await api(`/products/${encodeURIComponent(current.productID)}/related?limit=5`);
    items = Array.isArray(r) ? r : [];
  } catch {
    sec.classList.add("hidden");
    return;
  }
  if (!items.length) {
    sec.classList.add("hidden");
    return;
  }
  sec.classList.remove("hidden");
  listEl.innerHTML = "";
  for (const it of items) {
    const m = mallMeta[it.mall] || null;
    const li = document.createElement("li");
    li.className = "related-item";
    li.innerHTML = `
      <span class="watch-thumb"${it.image ? ` style="background-image:url('${String(it.image).replace(/'/g, "\\'")}')"` : ""}>${it.image ? "" : (m ? "" : "?")}${mallBadgeHtml(m)}</span>
      <span class="related-body">
        <span class="related-name"></span>
        <span class="related-price"></span>
      </span>`;
    const badgeImg = m ? li.querySelector(".watch-badge img") : null;
    if (badgeImg) {
      badgeImg.addEventListener("error", () => {
        badgeImg.replaceWith(document.createTextNode(m.label));
        badgeImg.parentElement.classList.add("b-fallback");
      });
    }
    li.querySelector(".related-name").textContent = it.name || it.product_id;
    li.querySelector(".related-price").textContent =
      it.last_price != null ? `${Number(it.last_price).toLocaleString()}원` : "";
    li.addEventListener("click", () => {
      if (it.url) chrome.tabs.create({ url: it.url });
    });
    listEl.appendChild(li);
  }
}

// ── 로딩 인디케이터 (v0.7.3) ───────────────────────────
function loadingRow(text = "불러오는 중…") {
  return `<li class="row-loading"><span class="spinner"></span>${text}</li>`;
}

// ── 오늘의 핫딜 ──────────────────────────────────────────
// T-58 확장 (v0.7.2): /recommendations 기간별 하락폭 큰 상품
let dealDays = 7;

async function loadDeals() {
  const listEl = $("dealList");
  const emptyEl = $("dealEmpty");
  listEl.innerHTML = loadingRow();
  emptyEl.classList.add("hidden");

  let deals;
  try {
    deals = await api(`/recommendations?limit=5&days=${dealDays}`);
  } catch {
    listEl.innerHTML = loadingRow("핫딜을 불러오지 못했습니다 (E-EXT-NET-1001)").replace("row-loading", "row-loading row-error");
    return;
  }
  if (!deals.length) {
    listEl.innerHTML = "";
    emptyEl.classList.remove("hidden");
    return;
  }
  listEl.innerHTML = "";
  for (const d of deals) {
    const m = mallMeta[d.mall] || null;
    const li = document.createElement("li");
    li.className = "deal-item";
    li.innerHTML = `
      <span class="watch-thumb"${d.image ? ` style="background-image:url('${String(d.image).replace(/'/g, "\\'")}')"` : ""}>${d.image ? "" : (m ? "" : "?")}${mallBadgeHtml(m)}</span>
      <span class="deal-body">
        <span class="watch-name"></span>
        <span class="deal-price"></span>
      </span>
      <span class="deal-pct">${d.reason === "low" ? "최저가" : `▼ ${d.drop_percent}%`}</span>`;
    const badgeImg = m ? li.querySelector(".watch-badge img") : null;
    if (badgeImg) {
      badgeImg.addEventListener("error", () => {
        badgeImg.replaceWith(document.createTextNode(m.label));
        badgeImg.parentElement.classList.add("b-fallback");
      });
    }
    li.querySelector(".watch-name").textContent = d.name || d.product_id;
    li.querySelector(".deal-price").textContent = `${Number(d.last_price).toLocaleString()}원`;
    if (d.previous_price) {
      const before = document.createElement("span");
      before.className = "deal-before";
      before.textContent = `${Number(d.previous_price).toLocaleString()}원`;
      li.querySelector(".deal-price").appendChild(before);
    }
    li.addEventListener("click", () => {
      if (d.url) chrome.tabs.create({ url: d.url });
    });
    listEl.appendChild(li);
  }
}

document.querySelectorAll(".deal-day-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    dealDays = Number(btn.dataset.days);
    document.querySelectorAll(".deal-day-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    loadDeals();
  });
});

// ── 현재 상품 섹션 ──────────────────────────────────────
let current = null; // { parsed, product }
let currentWatched = false;
let currentTargetPrice = null;

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
  currentTargetPrice = null;
  $("currentStats").innerHTML = `<span class="spinner"></span>`;

  // 현재 탭에서 직접 추출 (og:title 등) — v0.8.19: url 전달로 variant(vendorItemId) 확보,
  // 수량 옵션별 가격/통계를 서버에 variant 조회
  let liveTitle = null;
  let liveVariant = null;
  try {
    const msg = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT", url: tab.url });
    if (msg && msg.ok && msg.data) {
      if (msg.data.title) liveTitle = msg.data.title;
      if (msg.data.variant) liveVariant = msg.data.variant;
    }
  } catch {}

  const deviceId = await getDeviceId();
  try {
    const query = `/products/${encodeURIComponent(parsed.productID)}?device_id=${deviceId}`;
    const product = await api(
      liveVariant ? `${query}&variant=${encodeURIComponent(liveVariant)}` : query
    );
    if (product) {
      currentWatched = product.is_watched;
      currentTargetPrice = product.target_price || null;
      if (product.last_price != null) {
        $("currentPrice").textContent = `${Number(product.last_price).toLocaleString()}원`;
      }
      renderStats(product);
    } else {
      $("currentStats").textContent = "";
    }
  } catch (e) {
    $("currentStats").textContent = "";
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
  // v0.9.1 — 목표가 입력 행: 찜 상태에서만 표시, 기존 목표가 초기값
  const row = $("targetRow");
  row.classList.toggle("hidden", !currentWatched);
  if (currentWatched) {
    $("targetInput").value = currentTargetPrice ? String(currentTargetPrice) : "";
    $("targetInput").placeholder = currentTargetPrice ? `현재 목표가 ${Number(currentTargetPrice).toLocaleString()}원` : "목표가 (원)";
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
      currentTargetPrice = null;
    } else {
      const target = parseTargetPrice($("targetInput").value);
      await api(`/devices/${deviceId}/watches/${encodeURIComponent(current.productID)}`, {
        method: "PUT",
        body: JSON.stringify(target ? { target_price: target } : {}),
      });
      currentWatched = true;
      currentTargetPrice = target;
    }
    updateWatchBtn();
    loadList();
    chrome.runtime.sendMessage({ type: "WATCHES_INVALIDATE" }).catch(() => {}); // 목록 배지 캐시 무효화 (v0.8.5)
  } catch (e) {
    setStatus("저장 실패 — 서버 연결 확인");
  }
});

// 목표가 저장/삭제 (v0.9.1) — 빈 값이면 목표가 해제
function parseTargetPrice(value) {
  const v = parseInt(String(value || "").replace(/[^0-9]/g, ""), 10);
  if (!v || v < 1000 || v > 100000000) return null;
  return v;
}

$("targetSave").addEventListener("click", async () => {
  const deviceId = await getDeviceId();
  if (!deviceId || !current || !currentWatched) return;
  const target = parseTargetPrice($("targetInput").value);
  try {
    await api(`/devices/${deviceId}/watches/${encodeURIComponent(current.productID)}`, {
      method: "PUT",
      body: JSON.stringify(target ? { target_price: target } : {}),
    });
    currentTargetPrice = target;
    updateWatchBtn();
    setStatus(target ? `목표가 ${Number(target).toLocaleString()}원 저장` : "목표가 해제");
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

let watchCache = []; // v0.7.4 — 전체 찜 목록 캐시 (몰 필터는 로컬 처리)
let watchMallFilter = "all";

async function loadList() {
  const deviceId = await getDeviceId();
  $("watchList").innerHTML = loadingRow();
  $("emptyMsg").classList.add("hidden");
  if (!deviceId) {
    $("emptyMsg").classList.remove("hidden");
    return;
  }
  try {
    watchCache = await api(`/devices/${deviceId}/watches`);
  } catch {
    $("watchList").innerHTML = loadingRow("찜 목록을 불러오지 못했습니다 (E-EXT-NET-1001)").replace("row-loading", "row-loading row-error");
    return;
  }
  renderList();
}

function renderList() {
  $("watchCount").textContent = watchCache.length ? `(${watchCache.length})` : "";
  const filtered =
    watchMallFilter === "all" ? watchCache : watchCache.filter((w) => w.mall === watchMallFilter);
  if (!filtered.length) {
    $("watchList").innerHTML = "";
    $("emptyMsg").textContent = watchCache.length
      ? "이 몰에서 찜한 상품이 없습니다."
      : "찜한 상품이 없습니다.<br>상품 페이지에서 똑바 아이콘을 누르고 찜해 보세요.";
    $("emptyMsg").classList.remove("hidden");
    return;
  }
  $("emptyMsg").classList.add("hidden");
  $("watchList").innerHTML = "";

  for (const w of filtered) {
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
    // v0.9.1 — 품절/목표가 상태 표시 (품절 우선)
    if (w.sold_out) {
      checkEl.textContent = "품절";
      checkEl.classList.add("sold-out");
      li.classList.add("sold-out-row");
    } else if (w.target_price) {
      const tp = Number(w.target_price);
      const cur = w.last_price != null ? Number(w.last_price) : null;
      checkEl.textContent = `목표 ${tp.toLocaleString()}원${cur != null && cur <= tp ? " · 도달!" : ""}`;
      checkEl.classList.add("target-set");
      if (cur != null && cur <= tp) li.classList.add("target-hit");
    }
    const stale = staleCheckLabel(w.last_checked_at);
    if (stale && !w.sold_out) {
      checkEl.textContent += stale.text ? ` · ${stale.text}` : "";
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
        chrome.runtime.sendMessage({ type: "WATCHES_INVALIDATE" }).catch(() => {});
      });
    });
    li.addEventListener("click", () => {
      if (w.url) chrome.tabs.create({ url: w.url });
    });
    $("watchList").append(li);
  }
}

// 몰 필터 픽커 (v0.7.4) — 로컬 필터, 캐시 재렌더
document.querySelectorAll(".mall-filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    watchMallFilter = btn.dataset.mall;
    document.querySelectorAll(".mall-filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    renderList();
  });
});

// 찜 목록 접이식 (v0.7.6)
$("listToggle").addEventListener("click", () => {
  const collapsed = $("listSection").classList.toggle("collapsed");
  $("listToggle").textContent = collapsed ? "▸" : "▾";
});

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
  const slowTimer = setTimeout(() => {
    if ($("status").textContent === "불러오는 중…") $("status").textContent = "서버 연결 중… (최대 45초)";
  }, 8000);
  try {
    await loadCurrent();
  } catch {}
  await loadRelated();
  await loadDeals();
  await loadList();
  clearTimeout(slowTimer);
  $("status").textContent = "";
})();
