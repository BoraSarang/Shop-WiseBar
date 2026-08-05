// debug.js — 똑바 DebugLogger 공용 래퍼 (v0.9.3 디버그 창 + 중앙 로그)
// PLATFORM: extension (background SW / content script / popup / debug 창 공용)
// 레벨: [DEBUG]/[INFO]/[WARN]/[ERROR] + [PERF] (콘텐츠 스크립트 추출 시간, 100ms 예산)
//
// 구조:
//   - 모든 로그는 chrome.storage.local["debugLog"]에 누적 (닫기/탭 이동/SW 종료와 무관, 지우기 전까지 유지)
//   - content script(http/https 페이지)는 storage를 직접 쓰지 않고 background로 DEBUG_LOG 메시지를
//     위임 → background가 sender.tab로 탭ID/url/몰을 태깅해 중앙 기록 (여러 탭 로그 통일 관리)
//   - 로그마다 set하지 않도록 디바운스(300ms)로 배치 저장 — 성능/배터리 최소화
//   - chrome.storage.local["debugEnabled"] 켜짐 상태에서만 기록 (기본 콘솔 경유)
// AGENTS.md 19장 DebugPanel 표준 — 전용 디버그 창(chrome.windows.create) 대응.
// Queue/Cache 뷰어는 미적용(해당 기능 없음).

const DebugLogger = (() => {
  "use strict";
  const ENABLE_KEY = "debugEnabled";
  const LOG_KEY = "debugLog";
  const MAX_LOG = 2000; // 중앙 storage 보존 한도 (FIFO, 오래된 것부터 삭제)
  const FLUSH_MS = 300; // 디바운스 — 마지막 로그 후 이 시간 뒤 일괄 저장

  // 컨텍스트 판별: http/https 페이지(로드된 content script) → background로 위임
  const isContent =
    typeof location !== "undefined" &&
    /^https?:/.test(location.protocol || "") &&
    typeof chrome !== "undefined" &&
    chrome.runtime &&
    chrome.runtime.id;
  const scope = isContent ? "content" : typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id ? "ext" : "page";

  let enabled = false;
  let pending = []; // 디바운스 대기 배치
  let flushTimer = null;

  // 모듈 로드 시 debugEnabled 로드 + 저장소 잔여 로그 방어(아직 미사용, recent()가 직접 읽음)
  try {
    chrome.storage.local.get(ENABLE_KEY, (v) => {
      enabled = !!(v && v[ENABLE_KEY]);
    });
  } catch {
    enabled = false;
  }

  function safeString(v) {
    try {
      if (v instanceof Error) return `${v.name}: ${v.message}`;
      if (typeof v === "object") return JSON.parse(JSON.stringify(v));
      return String(v);
    } catch {
      if (typeof v === "object") {
        try {
          return JSON.stringify(v);
        } catch {
          return "[unserializable]";
        }
      }
      return String(v);
    }
  }

  function hashUrlTag() {
    // content 컨텍스트에서 현재 url와 몰을 태그로 포함 (background가 최종 태깅 전 보조 정보)
    try {
      const mall = window.MallParser && MallParser.detectMall(location.href);
      return { url: location.href, mall: (mall && mall.mall) || null };
    } catch {
      return {};
    }
  }

  // background로 위임 (content만): background가 sender.tab 태깅 후 중앙 기록
  function sendDelegated(entry) {
    try {
      chrome.runtime.sendMessage({ type: "DEBUG_LOG", entry });
    } catch {
      /* 컨텍스트 소멸 등 무해 */
    }
  }

  // 실제 storage 기록 (background/popup/debug 창에서만 direct). 몰/탭 태그는 entry에 이미 있음.
  function persistSync(entries) {
    chrome.storage.local.get(LOG_KEY, (v) => {
      let arr = Array.isArray(v && v[LOG_KEY]) ? v[LOG_KEY] : [];
      arr = arr.concat(entries);
      arr = arr.slice(-MAX_LOG);
      chrome.storage.local.set({ [LOG_KEY]: arr }, () => {});
    });
  }

  function enqueue(level, args, consoleFn) {
    const ts = Date.now();
    const text = args.map((a) => (typeof a === "string" ? a : safeString(a))).join(" ");
    // 저장 대상 항목 (몰/url 태그 — content는 위임 시에도 보조로 포함)
    const entry = { ts, level, scope, text };
    if (isContent) Object.assign(entry, hashUrlTag());

    // 콘솔 경유 (동작 확인용, 로그 켜짐 무관 — 항상 출력은 유지)
    const line = debugLine(entry);
    try {
      consoleFn ? consoleFn(line) : console[level.toLowerCase()](line);
    } catch {
      /* 콘솔 미존재 환경 무해 */
    }

    if (!enabled) return;

    if (isContent) {
      sendDelegated(entry); // content는 즉시 background 위임 (배치 불필요, 비동기)
      return;
    }
    // ext(background/popup/debug 창) → 디바운스 배치 저장
    pending.push(entry);
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(() => {
      flushTimer = null;
      const batch = pending;
      pending = [];
      persistSync(batch);
    }, FLUSH_MS);
  }

  function debugLine(e) {
    const t = new Date(e.ts).toISOString().replace("T", " ").slice(0, 23);
    const scopeMark = e.scope === "content" ? "[TAB]" : `[${e.scope.toUpperCase()}]`;
    const mallMark = e.mall ? `[${e.mall.toUpperCase()}]` : "";
    return `[${t}] [${e.level}] ${scopeMark}${mallMark} ${e.text}`;
  }

  // public
  function recent(n = 30) {
    // storage에서 최근 n줄(원시 entry)을 시각역순 → 시간순 배열로 반환
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(LOG_KEY, (v) => {
          const arr = Array.isArray(v && v[LOG_KEY]) ? v[LOG_KEY] : [];
          resolve(arr.slice(-n));
        });
      } catch {
        resolve([]);
      }
    });
  }

  return {
    get enabled() {
      return enabled;
    },
    isEnabled() {
      return enabled;
    },
    setEnabled(v) {
      enabled = !!v;
      try {
        chrome.storage.local.set({ [ENABLE_KEY]: enabled });
      } catch {
        /* storage 미사용 환경 무해 */
      }
      return enabled;
    },
    debug(...a) {
      if (!enabled) return;
      enqueue("DEBUG", a, console.log);
    },
    info(...a) {
      enqueue("INFO", a, console.log);
    },
    warn(...a) {
      enqueue("WARN", a, console.warn);
    },
    error(...a) {
      enqueue("ERROR", a, console.error);
    },
    perf(label, ms) {
      enqueue("PERF", [`${label} ${ms.toFixed(1)}ms`], console.log);
    },
    recent, // Promise<entry[]> — storage 기반 (SW 종료 후에도 유지)
    // 디버그 창에서 원하는 만큼의 entry를 필터 가능하게 반환
    list(n = 2000) {
      return recent(n);
    },
    clear() {
      pending = [];
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      try {
        chrome.storage.local.set({ [LOG_KEY]: [] });
      } catch {
        /* 무해 */
      }
    },
    // 저장 대상 entry를 화면 표시용 문자열로 변환 (디버그 창 표준 포맷)
    format(entry) {
      return debugLine(entry);
    },
    scope,
  };
})();