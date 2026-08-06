// capture.js — 웨일 스토어 심사용 스크린샷 자동 캡처 (T-96a)
//
// 사용법:
//   node capture.js [상품URL]
//   예) node capture.js "https://www.coupang.com/vp/products/1804998758"
//   예) node capture.js "https://smartstore.naver.com/main/products/1000000000"
//   URL 미지정 시 기본 예시 URL 사용 (데이터가 없으면 팝업 상단이 비어 보일 수 있음)
//
// 동작:
//   1. 웨일(Whale)을 실제 창으로 실행 (headless 아님 — 사용자가 진행 확인 가능)
//   2. 데모 데이터 자동 주입: 핫딜 탭과 현재 상품 탭을 채우기 위해
//      서버에 "demo:" 상품 + 가격 이력(하락)을 넣음
//   3. 똑바 확장을 unpacked로 로드 (--load-extension)
//   4. 상품 페이지를 탭으로 열기
//   5. 팝업(chrome-extension://.../popup/popup.html)을 백그라운드 탭으로 열되
//      상품 탭이 active로 유지되게 해 "현재 상품" 인식 보장
//   6. 스크린샷 저장:
//      - shop-wisebar-01.png : 현재 상품 탭 (팝업 그대로 320x600)
//      - shop-wisebar-02.png : 핫딜 "7일" 탭
//   7. 데모 데이터 자동 정리: 넣었던 demo 상품 전부 삭제 (DELETE /products/{id})
//
// 사전 준비:
//   npm install   (최초 1회, playwright-core 설치)
//   서버가 살아 있어야 핫딜/상품 데이터가 표시됩니다 (https://shop-wisebar.onrender.com)
//
// 비고: 팝업은 320x600 고정 크기라 화면 중앙이 아닌 실제 팝업 크기로 저장됩니다.
//       스토어 요구 해상도(예: 1280x800)가 필요하면 가이드의 "크기 조정"을 참고하세요.
import { chromium } from "playwright-core";
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const EXT_DIR = path.join(ROOT, "extension");
const OUT_DIR = path.join(ROOT, "docs/screenshots/store");
const WHALE_CANDIDATES = [
  "/Applications/Whale.app/Contents/MacOS/Whale",
  "/Applications/Naver Whale.app/Contents/MacOS/Naver Whale",
];

// ── 서버 API (데모 데이터 주입/정리) ─────────────────────
const SERVER = process.env.SWB_SERVER || "https://shop-wisebar.onrender.com";
const API = `${SERVER}/api/v1`;

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    method: opts.method || "GET",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path}`);
  return res.status === 204 ? null : res.json();
}

// 데모 상품 정의 — 핫딜 탭(5% 이상 하락) + 현재 상품 탭(가격 통계)을 채우기 위한 가상 상품.
// url은 스마트스토어 형식이라 실제 클릭은 실패하지만 팝업 렌더링에는 문제없음.
const DEMO_PRODUCTS = [
  { id: "demo:hdmi:1", mall: "naver", name: "4K HDMI 케이블 2m", price: 12900, drop: 9900, image: null },
  { id: "demo:stand:2", mall: "naver", name: "노트북 거치대 알루미늄", price: 38900, drop: 31900, image: null },
  { id: "demo:key:3", mall: "naver", name: "기계식 키보드 (적축)", price: 89000, drop: 74900, image: null },
  { id: "demo:mouse:4", mall: "naver", name: "무선 마우스 슬림", price: 27900, drop: 23500, image: null },
  { id: "demo:light:5", mall: "naver", name: "USB LED 무드등", price: 15900, drop: 12900, image: null },
];

const DEMO_IDS = DEMO_PRODUCTS.map((p) => p.id);

// 가격 2개(현재가→하락가)를 1.1s 간격으로 업로드 — 같은 초 UNIQUE 충돌 회피 + 5% 이상 하락 이력 생성
async function seedDemoProduct(p) {
  const url = `https://smartstore.naver.com/demo/products/${p.id}`;
  await apiFetch("/products/batch", {
    method: "POST",
    body: { items: [{ product_id: p.id, mall: p.mall, url, name: p.name, price: p.price }] },
  });
  await new Promise((r) => setTimeout(r, 1100));
  await apiFetch(`/products/${encodeURIComponent(p.id)}/prices`, {
    method: "POST",
    body: { price: p.drop },
  });
  await new Promise((r) => setTimeout(r, 1100));
}

async function seedDemoData() {
  console.log(`▸ 데모 데이터 주입 (${DEMO_IDS.length}개)…`);
  for (const p of DEMO_PRODUCTS) await seedDemoProduct(p);
  console.log("✓ 데모 데이터 주입 완료");
}

// 현재 상품 탭 채우기 — 사용자가 지정한 상품 페이지의 productID에 가격 이력(하락) 3개를 넣음.
// 이미 서버에 존재하는 상품이면 건드리지 않는다(실데이터 보호). 반환: {created:boolean}
async function seedCurrentProduct(productUrl) {
  const parsed = parseProductId(productUrl);
  if (!parsed) {
    console.warn("⚠ 상품 URL을 인식하지 못해 현재 상품 탭은 빈 상태로 캡처합니다.");
    return { created: false, id: null };
  }
  const pid = parsed.id;
  // 기존 존재 여부 확인 (404면 없음)
  let existed = true;
  try {
    await apiFetch(`/products/${encodeURIComponent(pid)}`);
  } catch {
    existed = false;
  }
  if (existed) {
    console.log(`⚠ 현재 상품(${pid})은 서버에 이미 존재 — 실데이터 보호를 위해 데모 주입 생략`);
    return { created: false, id: pid };
  }
  // 신규 상품: upsert(가격 없이) + 가격 이력 3개 (하락 → 역대 최저가 배지 + 통계 표시)
  await apiFetch("/products/batch", {
    method: "POST",
    body: {
      items: [{ product_id: pid, mall: parsed.mall, url: productUrl, name: "스크린샷용 상품" }],
    },
  });
  const prices = [9900, 9400, 8900];
  for (const price of prices) {
    await apiFetch(`/products/${encodeURIComponent(pid)}/prices`, {
      method: "POST",
      body: { price },
    });
    await new Promise((r) => setTimeout(r, 1100));
  }
  console.log(`✓ 현재 상품 데모 주입: ${pid} (${prices.length}개 가격 이력)`);
  return { created: true, id: pid };
}

async function cleanupDemoData() {
  console.log("▸ 데모 데이터 정리…");
  for (const id of DEMO_IDS) {
    try {
      await apiFetch(`/products/${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch (e) {
      console.warn(`⚠ 데모 삭제 실패 ${id}: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  console.log("✓ 데모 데이터 정리 완료");
}

function findWhale() {
  for (const p of WHALE_CANDIDATES) {
    if (existsSync(p)) return p;
  }
  return null;
}

// 1) service worker URL에서 확장 ID 추출 (MV3에서 가장 안정적)
function extIdFromServiceWorkers(context) {
  for (const sw of context.serviceWorkers()) {
    try {
      const u = new URL(sw.url());
      if (u.protocol === "chrome-extension:") return u.host;
    } catch {}
  }
  return null;
}

// 2) 백업: Preferences 파일의 extensions.settings에서 확장 ID 추출
function extIdFromPreferences(userDataDir) {
  const pref = path.join(userDataDir, "Default", "Preferences");
  try {
    const prefs = JSON.parse(readFileSync(pref, "utf-8"));
    const exts = prefs.extensions?.settings || {};
    for (const [id, info] of Object.entries(exts)) {
      if (info.path === EXT_DIR) return id;
    }
  } catch {}
  return null;
}

const args = process.argv.slice(2);
const productUrl =
  args[0] || "https://smartstore.naver.com/gamewoori/products/13360049393";

// MallParser 규칙을 축약 재현 — URL에서 productID 추출 (popup.js가 인식하는 값과 동일해야 함)
function parseProductId(urlString) {
  try {
    const url = new URL(urlString);
    const host = url.hostname.toLowerCase();
    const path = url.pathname;
    if (host.includes("coupang.com")) {
      const m = path.match(/\/vp\/products\/(\d+)/);
      return m ? { mall: "coupang", id: m[1] } : null;
    }
    if (host.includes("smartstore.naver.com")) {
      const m = path.match(/^\/([a-zA-Z0-9_-]+)\/products\/(\d+)/);
      return m ? { mall: "naver", id: `store:${m[1]}:${m[2]}` } : null;
    }
    if (host.includes("brand.naver.com")) {
      const m = path.match(/^\/([a-zA-Z0-9_-]+)\/products\/(\d+)/);
      return m ? { mall: "naver", id: `brand:${m[1]}:${m[2]}` } : null;
    }
    if (host.includes("oliveyoung.co.kr")) {
      const goodsNo = url.searchParams.get("goodsNo");
      return goodsNo ? { mall: "oliveyoung", id: goodsNo } : null;
    }
  } catch {}
  return null;
}

const whalePath = findWhale();
if (!whalePath) {
  console.error("✗ 웨일(Whale)을 찾을 수 없습니다. /Applications/Whale.app 설치를 확인해 주세요.");
  process.exit(1);
}
if (!existsSync(EXT_DIR)) {
  console.error(`✗ 확장 디렉토리가 없습니다: ${EXT_DIR}`);
  process.exit(1);
}

console.log(`✓ 웨일: ${whalePath}`);
console.log(`✓ 확장: ${EXT_DIR}`);
console.log(`✓ 상품 URL: ${productUrl}`);

const userDataDir = path.join(OUT_DIR, ".whale-profile");
let context;
let demoSeeded = false;
let currentProductCreated = false;
try {
  // 데모 데이터 주입 (스크린샷 채우기) — 실패해도 캡처 진행은 하되 경고만
  try {
    await seedDemoData();
    demoSeeded = true;
    const cur = await seedCurrentProduct(productUrl);
    currentProductCreated = cur.created;
  } catch (e) {
    console.warn(`⚠ 데모 데이터 주입 실패: ${e.message}`);
    console.warn("  (서버가 콜드스타트 중이거나 네트워크 문제 — 캡처는 계속합니다)");
  }

  context = await chromium.launchPersistentContext(userDataDir, {
    executablePath: whalePath,
    headless: false, // 실제 화면 — 심사용 스크린샷은 실제 렌더링 필요
    viewport: { width: 1280, height: 800 },
    args: [
      `--disable-extensions-except=${EXT_DIR}`,
      `--load-extension=${EXT_DIR}`,
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });

  // 확장 ID 확인 (service worker → Preferences 백업, 최대 10초)
  let extId = null;
  for (let i = 0; i < 20; i++) {
    extId = extIdFromServiceWorkers(context) || extIdFromPreferences(userDataDir);
    if (extId) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!extId) {
    console.error(
      "✗ 확장 ID를 찾지 못했습니다. 웨일 창에서 chrome://extensions → 개발자 모드 → '똑바' 확장 ID를 확인해 주세요."
    );
    await context.close();
    process.exit(1);
  }
  console.log(`✓ 확장 ID: ${extId}`);

  // 상품 페이지 탭 (스크린샷 1의 배경 — 팝업이 이 탭의 상품을 인식)
  const productPage = await context.newPage();
  await productPage.goto(productUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await productPage.waitForTimeout(4000); // 가격 DOM + 콘텐츠 스크립트 로드 대기

  // 팝업 탭 열기 — "commit"까지만 기다린 뒤 상품 탭을 다시 앞으로.
  // popup.js의 chrome.tabs.query({active:true})가 상품 탭을 잡도록 하기 위함.
  const popupUrl = `chrome-extension://${extId}/popup/popup.html`;
  const popupPage = await context.newPage();
  await popupPage.goto(popupUrl, { waitUntil: "commit", timeout: 30000 });
  await productPage.bringToFront(); // 이제 상품 탭이 active → 팝업 init이 상품을 읽음
  await popupPage.waitForLoadState("domcontentloaded");
  await popupPage.waitForTimeout(6000); // 서버 API 로드 + 렌더 대기

  // ── 팝업 상태 검증 (텍스트 전용 모델 대응 — 스크린샷 전에 화면 상태 로깅) ──
  await popupPage.evaluate(() => document.fonts?.ready);
  const dump = await popupPage.evaluate(() => {
    const $ = (id) => document.getElementById(id);
    return {
      currentName: $("currentName")?.textContent?.trim() || "",
      currentPrice: $("currentPrice")?.textContent?.trim() || "",
      currentStats: $("currentStats")?.textContent?.trim() || "",
      trendStats: $("trendStats")?.textContent?.trim() || "",
      deals: Array.from(document.querySelectorAll(".deal-item .watch-name")).map(
        (el) => el.textContent.trim()
      ),
      dealEmptyVisible: !$("dealEmpty")?.classList.contains("hidden"),
      status: $("status")?.textContent?.trim() || "",
    };
  });
  console.log("▸ 팝업 상태:", JSON.stringify(dump, null, 2));

  // ── 스크린샷 1: 현재 상품 탭 (팝업 그대로 320x600) ──
  const popupBody = await popupPage.$("body");
  if (!popupBody) throw new Error("popup body를 찾을 수 없습니다.");
  await popupBody.screenshot({ path: path.join(OUT_DIR, "shop-wisebar-01.png") });
  console.log("✓ 저장: docs/screenshots/store/shop-wisebar-01.png (상품 탭)");

  // ── 스크린샷 2: 핫딜 "7일" 탭 ──
  try {
    await popupPage.click("button[data-days='7']");
    await popupPage.waitForTimeout(2500);
  } catch (e) {
    console.log("⚠ 핫딜 7일 버튼 클릭 실패 (그대로 진행):", e.message);
  }
  await popupBody.screenshot({ path: path.join(OUT_DIR, "shop-wisebar-02.png") });
  console.log("✓ 저장: docs/screenshots/store/shop-wisebar-02.png (핫딜 탭)");

  // 실제 창 확인을 위해 잠시 유지 후 종료
  console.log("✓ 3초 후 브라우저를 닫습니다. 화면을 확인하세요.");
  await popupPage.waitForTimeout(3000);
  await context.close();
  console.log("✓ 완료 — docs/screenshots/store/ 에서 결과 확인");
} catch (e) {
  console.error("✗ 캡처 실패:", e.message);
  if (context) await context.close().catch(() => {});
  process.exitCode = 1;
} finally {
  // 데모 데이터 정리 (주입에 성공했으면 무조건) — 캡처 실패/성공과 무관하게
  if (demoSeeded) {
    try {
      await cleanupDemoData();
    } catch (e) {
      console.warn(`⚠ 데모 데이터 정리 실패: ${e.message}`);
      console.warn(`  수동 정리: node cleanup.js`);
    }
  }
  if (currentProductCreated) {
    const parsed = parseProductId(productUrl);
    try {
      await apiFetch(`/products/${encodeURIComponent(parsed.id)}`, { method: "DELETE" });
      console.log("✓ 스크린샷용 상품 정리 완료");
    } catch (e) {
      console.warn(`⚠ 스크린샷용 상품 정리 실패: ${e.message}`);
      console.warn("  수동 정리: 위 상품 ID로 DELETE /products/{id} 호출");
    }
  }
}
