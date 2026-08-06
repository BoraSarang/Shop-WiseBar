// popup.js — 알림 내역 + 현재 상품 찜 + 찜 목록
// PLATFORM: extension

const CONFIG = SWB_CONFIG; // common.js 공용 (서버 주소 단일 관리)

const $ = (id) => document.getElementById(id);

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
let currentPrice = null; // v0.9.1 — 목표가 입력 기본값용 (마지막 수집 가격)

async function loadCurrent() {
  const { tab, parsed } = await currentTabProduct();
  $("currentActions").classList.add("hidden");
  $("currentPrice").textContent = "";
  $("dealBadge").classList.add("hidden");
  $("currentStats").textContent = "";
  $("mallLinks").classList.add("hidden");
  $("currentName").classList.remove("center");
  if (!parsed) {
    $("currentName").textContent = "쇼핑몰의 상품 페이지를 열어주세요";
    $("currentName").classList.add("center");
    $("mallLinks").classList.remove("hidden");
    return;
  }
  current = parsed;
  currentWatched = false;
  currentTargetPrice = null;
  $("currentStats").innerHTML = `<span class="spinner"></span>`;

  // 가격 통계 요약 (v0.10.0) — 7일/30일/역대 최저가·평균 (variant와 병렬)
  $("trendStats").classList.add("hidden");
  const statsReq = (variant) => {
    const base = `/products/${encodeURIComponent(parsed.productID)}/stats`;
    return api(variant ? `${base}?variant=${encodeURIComponent(variant)}` : base)
      .then((s) => ({ ok: true, s }))
      .catch(() => ({ ok: false, s: null }));
  };

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
  // 가격 통계 요약 (v0.10.0) — 상품 조회와 병렬로 7일/30일/역대 집계
  const statsPromise = statsReq(liveVariant);
  try {
    const query = `/products/${encodeURIComponent(parsed.productID)}?device_id=${deviceId}`;
    const product = await api(
      liveVariant ? `${query}&variant=${encodeURIComponent(liveVariant)}` : query
    );
    if (product) {
      currentWatched = product.is_watched;
      currentTargetPrice = product.target_price || null;
      currentPrice = product.last_price != null ? Number(product.last_price) : null;
      if (currentPrice != null) {
        $("currentPrice").textContent = `${currentPrice.toLocaleString()}원`;
      }
      renderStats(product);
    } else {
      $("currentStats").textContent = "";
    }
  } catch (e) {
    $("currentStats").textContent = "";
    if (e.status !== 404) return;
  }
  const statsRes = await statsPromise;
  if (statsRes.ok) renderTrendStats(statsRes.s);
  $("currentName").textContent =
    liveTitle || (await fetchProductName(parsed.productID)) || `${mallLabel(parsed.mall)} 상품`;
  $("currentActions").classList.remove("hidden");
  updateWatchBtn();
}

// 가격 통계 요약 배너 (v0.10.0) — 7일/30일 최저가·평균 + 역대 최저가(날짜)
function renderTrendStats(s) {
  const el = $("trendStats");
  if (!s) return;
  const parts = [];
  const fmt = (v) => (v == null ? null : `${Number(v).toLocaleString()}원`);
  const fmtDate = (d) => (d ? d.slice(2).replace(/-/g, "/") : null); // YYYY-MM-DD → YY/MM/DD
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
  // v0.9.1 — 목표가 입력 행: 찜 상태에서만 표시, 목표가 없으면 현재가 기본값,
  // 설정 해제 버튼은 목표가가 있으면 활성화
  const row = $("targetRow");
  const clearBtn = $("targetClear");
  const status = $("targetStatus");
  row.classList.toggle("hidden", !currentWatched);
  clearBtn.disabled = !currentTargetPrice;
  if (currentWatched) {
    const input = $("targetInput");
    if (currentTargetPrice) {
      input.value = String(currentTargetPrice);
      status.textContent = `${Number(currentTargetPrice).toLocaleString()}원 이하 알림 중`;
      status.classList.add("on");
    } else if (currentPrice) {
      input.value = String(currentPrice);
      status.textContent = "목표가 미설정";
      status.classList.remove("on");
    } else {
      input.value = "";
      status.textContent = "목표가 미설정";
      status.classList.remove("on");
    }
    input.placeholder = "목표가 (원)"; // 고정 (문구 잘리지 않게 짧게 유지)
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

// 목표가 설정 해제 (v0.9.1)
$("targetClear").addEventListener("click", async () => {
  const deviceId = await getDeviceId();
  if (!deviceId || !current || !currentWatched || !currentTargetPrice) return;
  try {
    await api(`/devices/${deviceId}/watches/${encodeURIComponent(current.productID)}`, {
      method: "PUT",
      body: JSON.stringify({}),
    });
    currentTargetPrice = null;
    updateWatchBtn();
    setStatus("목표가 해제");
  } catch (e) {
    setStatus("저장 실패 — 서버 연결 확인");
  }
});

// ── 쇼핑몰 뱃지 (연관 상품·핫딜 공용) ───────────────────
const mallMeta = {
  naver: { label: "네이버", cls: "b-naver", icon: "https://www.google.com/s2/favicons?domain=www.naver.com&sz=32" },
  coupang: { label: "쿠팡", cls: "b-coupang", icon: "https://www.google.com/s2/favicons?domain=www.coupang.com&sz=32" },
  oliveyoung: { label: "올영", cls: "b-oliveyoung", icon: "https://www.google.com/s2/favicons?domain=www.oliveyoung.co.kr&sz=32" },
};

function mallBadgeHtml(m) {
  return m ? `<em class="watch-badge ${m.cls}"><img src="${m.icon}" alt="${m.label}"></em>` : "";
}

// 함께 본 상품 접이식 (v0.9.2)
$("relatedToggle").addEventListener("click", () => {
  const collapsed = $("related").classList.toggle("collapsed");
  $("relatedToggle").textContent = collapsed ? "▸" : "▾";
});

// ── 공통 ────────────────────────────────────────────────
function setStatus(text) {
  $("status").textContent = text;
  setTimeout(() => ($("status").textContent = ""), 2500);
}

// ── 디버그 창 열기 (v0.9.3) ─────────────────────────────
// 전용 디버그 창(chrome.windows.create popup)은 background가 관리(단축키와 동일).
// 팝업 버튼은 background로 OPEN_DEBUG 메시지를 보내 창을 열거나 포커스한다.
$("debugBtn").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "OPEN_DEBUG" }).catch(() => {});
});

(async function init() {
  // 디버그 패널 표시(debugEnabled)가 켜져 있을 때만 디버그 버튼 노출 (v0.9.3)
  const { debugEnabled } = await chrome.storage.local.get("debugEnabled");
  if (!debugEnabled) $("debugBtn").classList.add("hidden");
  const shortcut = /Mac|iPhone|iPad/.test(navigator.platform) ? "Command+D" : "Ctrl+Shift+Y";
  $("debugBtn").title = `디버그 창 열기 (${shortcut})`;

  $("status").textContent = "불러오는 중…";
  const slowTimer = setTimeout(() => {
    if ($("status").textContent === "불러오는 중…") $("status").textContent = "서버 연결 중…";
  }, 8000);
  try {
    await loadCurrent();
  } catch {}
  await loadRelated();
  await loadDeals();
  clearTimeout(slowTimer);
  $("status").textContent = "";
})();
