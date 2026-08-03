// onboarding.js — 설치 직후 사용법 안내 + 툴바 고정 감지
// PLATFORM: extension

const PINNED_HTML =
  '<b>완료!</b> 똑바가 툴바에 고정되어 있습니다.';
const UNPINNED_HTML =
  '아직 툴바에 고정되어 있지 않습니다.<br>' +
  '① 브라우저 오른쪽 위 <b>퍼즐(확장 프로그램)</b> 아이콘을 클릭<br>' +
  '② 똑바 오른쪽의 <b>핀 📌</b> 을 눌러 고정하면 언제든 빠르게 접근할 수 있어요.';

function renderPinState(isOnToolbar) {
  const box = document.getElementById("pinBox");
  if (isOnToolbar) {
    box.className = "pin-box ok";
    box.innerHTML = PINNED_HTML;
  } else {
    box.className = "pin-box";
    box.innerHTML = UNPINNED_HTML;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  try {
    chrome.action.getUserSettings().then((s) => renderPinState(!!s.isOnToolbar));
  } catch {
    renderPinState(false);
  }
  document.getElementById("optLink").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
});
