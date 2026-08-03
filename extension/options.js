// options.js — 똑바 익스텐션 설정 페이지 (서버/기기 정보)
// PLATFORM: extension

const CONFIG = SWB_CONFIG;

const $ = (id) => document.getElementById(id);

async function loadServerStatus() {
  try {
    const res = await fetch(`${CONFIG.server}/health`);
    if (res.ok) {
      const j = await res.json();
      $("serverStatus").textContent = j.status === "ok" ? "연결됨" : `이상 (${j.status})`;
      $("serverStatus").className = "ok";
    } else {
      $("serverStatus").textContent = `오류 (HTTP ${res.status})`;
      $("serverStatus").className = "fail";
    }
  } catch {
    $("serverStatus").textContent = "연결 실패 (E-EXT-NET-1001)";
    $("serverStatus").className = "fail";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  $("server").textContent = `${CONFIG.server}${CONFIG.api}`;
  const stored = await chrome.storage.local.get("deviceId");
  $("deviceId").textContent = stored.deviceId || "등록 전 (상품 페이지에서 똑바 버튼을 누르면 생성됩니다)";
  $("copyBtn").addEventListener("click", async () => {
    if (!stored.deviceId) return;
    await navigator.clipboard.writeText(stored.deviceId);
    $("copyBtn").textContent = "복사됨";
    setTimeout(() => ($("copyBtn").textContent = "복사"), 1500);
  });
  $("helpBtn").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
  });
  loadServerStatus();
});
