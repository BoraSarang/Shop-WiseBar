// debug-view.js — 똑바 디버그 창 로직 (v0.9.3)
// chrome.windows.create로 연 전용 창 페이지 — 2초 폴링으로 storage 로그를 읽어 표시.
// 필터(레벨/몰/탭/검색) + 전체 복사 + 지우기. 닫기 전까지 계속 누적 갱신.
// PLATFORM: extension (debug 창)

const $ = (id) => document.getElementById(id);

let logs = []; // 최근 원본 entry (필터 전)
let paused = false;

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function levelClass(level) {
  if (level === "ERROR") return "d-err";
  if (level === "WARN") return "d-warn";
  if (level === "PERF") return "d-perf";
  if (level === "DEBUG") return "d-debug";
  return "";
}

function mallLabel(mall) {
  return { naver: "네이버", coupang: "쿠팡", oliveyoung: "올영" }[mall] || (mall || "");
}

function entryHtml(e) {
  const t = new Date(e.ts).toISOString().replace("T", " ").slice(0, 23);
  const cls = levelClass(e.level);
  const scopeMark =
    e.scope === "content" ? `[TAB${e.tabId != null ? " " + e.tabId : ""}]` : `[${(e.scope || "ext").toUpperCase()}]`;
  const mallMark = e.mall ? `[${mallLabel(e.mall)}]` : "";
  // 탭/몰/url은 회색 메타로 별도 표시 (색상 규칙은 레벨만)
  let meta = "";
  if (e.tabId != null || e.mall || e.url) {
    const parts = [];
    if (e.tabId != null) parts.push(`tab#${e.tabId}`);
    if (e.mall) parts.push(mallLabel(e.mall));
    if (e.url) parts.push(e.url);
    meta = `<span class="d-meta">(${esc(parts.join(" · "))})</span>`;
  }
  const body = cls ? `<span class="${cls}">${esc(e.text)}</span>` : esc(e.text);
  return `<span class="d-meta">${t}</span> [${e.level}] ${scopeMark}${mallMark} ${body} ${meta}`;
}

function rebuildTabs() {
  const sel = $("fTab");
  const cur = sel.value;
  const tabSet = new Set();
  for (const e of logs) if (e.tabId != null) tabSet.add(e.tabId);
  const ids = [...tabSet].sort((a, b) => a - b);
  sel.innerHTML = '<option value="">전체</option>' + ids.map((id) => `<option value="${id}">탭 #${id}</option>`).join("");
  if (ids.includes(Number(cur))) sel.value = String(cur);
}

function filtered() {
  const lv = $("fLevel").value;
  const mall = $("fMall").value;
  const tab = $("fTab").value;
  const q = $("fText").value.trim().toLowerCase();
  return logs.filter((e) => {
    if (lv && e.level !== lv) return false;
    if (mall && e.mall !== mall) return false;
    if (tab && String(e.tabId) !== tab) return false;
    if (q && !(e.text || "").toLowerCase().includes(q) && !((e.url || "") + "").toLowerCase().includes(q)) return false;
    return true;
  });
}

function render() {
  const rows = filtered();
  const el = $("log");
  if (!rows.length) {
    el.textContent = "(로그 없음 — 쇼핑탭을 방문하거나 상품을 수집하면 여기에 쌓입니다)";
    $("count").textContent = "0";
    return;
  }
  el.innerHTML = rows.map(entryHtml).join("\n");
  $("count").textContent = `${rows.length} / ${logs.length}건`;
  el.scrollTop = el.scrollHeight; // 자동 스크롤: 항상 최신이 보이도록
}

async function refresh() {
  if (paused) return;
  try {
    logs = await DebugLogger.list(2000);
  } catch {
    return;
  }
  rebuildTabs();
  render();
}

async function copyAll() {
  const text = logs
    .map((e) => DebugLogger.format(e))
    .join("\n");
  try {
    await navigator.clipboard.writeText(text || "(로그 없음)");
    $("copyBtn").textContent = "복사됨";
    setTimeout(() => ($("copyBtn").textContent = "전체 복사"), 1500);
  } catch (e) {
    DebugLogger.warn("로그 복사 실패", e);
  }
}

function clearAll() {
  DebugLogger.clear();
  logs = [];
  refresh();
}

document.addEventListener("DOMContentLoaded", () => {
  ["fLevel", "fMall", "fTab"].forEach((id) => $(id).addEventListener("change", render));
  $("fText").addEventListener("input", render);
  $("pauseBtn").addEventListener("click", () => {
    paused = !paused;
    $("pauseBtn").textContent = paused ? "재개" : "일시정지";
    if (!paused) refresh();
  });
  $("copyBtn").addEventListener("click", copyAll);
  $("clearBtn").addEventListener("click", clearAll);
  refresh();
  setInterval(refresh, 2000); // 2초 폴링 — 닫기 전까지 계속 누적/갱신
});