// e2e.js — 똑바(Shop WiseBar) 확장 E2E 자동 검증 (T-98)
//
// 검증 파이프라인: 서버 저장 → 팝업 표시 전체 왕복
//   1) 확장 복사본 생성 (common.js 서버 주소 → 로컬 포트로 치환)
//   2) 데모 데이터 주입 (핫딜 5개 + 현재 상품 가격 이력)
//   3) Whale + 확장 로드 (영구 프로필 재사용 — 네이버 봇 감지 우회)
//   4) 상품 페이지 방문 → 콘텐츠 스크립트 가격 추출 → 서버 저장 대기
//   5) 팝업 열기 → 렌더링 검증 (현재 상품/통계/배지/핫딜)
//   6) 서버 API 재조회로 저장 검증 (price_points)
//   7) 데모 데이터 자동 정리 + 결과 리포트
//
// 사용법: node e2e.js [상품URL]
//   (run-e2e.sh가 로컬 서버를 띄운 뒤 호출 — 직접 실행 시 서버 필요)
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const EXT_DIR = path.join(ROOT, "extension");
const PROFILE_SRC = path.join(ROOT, "docs/screenshots/store/.whale-profile");

// ── 서버 ─────────────────────────────────────────────
const PORT = process.env.SWB_E2E_PORT || "8765";
const SERVER = `http://127.0.0.1:${PORT}`;
const API = `${SERVER}/api/v1`;
// 기본 상품: 올리브영 (네이버 스마트스토어는 자동화 브라우저 접속 시 429 봇 차단 가능성 —
// E2E 안정성을 위해 봇 차단이 없는 올리브영 상세 페이지를 기본 사용)
const PRODUCT_URL =
  process.argv[2] ||
  "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000224494";

// ── 결과 추적 ────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures = [];
function check(name, cond, detail = "") {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

// ── 서버 API ─────────────────────────────────────────
async function apiFetch(pathStr, opts = {}) {
  const res = await fetch(`${API}${pathStr}`, {
    method: opts.method || "GET",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    signal: AbortSignal.timeout(45000),
  });
  if (res.status === 404) throw Object.assign(new Error("NOT_FOUND"), { status: 404 });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${pathStr}`);
  return res.status === 204 ? null : res.json();
}

// 데모 상품 — 핫딜 탭 채우기 (capture.js와 동일 정의)
const DEMO_PRODUCTS = [
  { id: "demo:hdmi:1", mall: "naver", name: "4K HDMI 케이블 2m", price: 12900, drop: 9900 },
  { id: "demo:stand:2", mall: "naver", name: "노트북 거치대 알루미늄", price: 38900, drop: 31900 },
  { id: "demo:key:3", mall: "naver", name: "기계식 키보드 (적축)", price: 89000, drop: 74900 },
  { id: "demo:mouse:4", mall: "naver", name: "무선 마우스 슬림", price: 27900, drop: 23500 },
  { id: "demo:light:5", mall: "naver", name: "USB LED 무드등", price: 15900, drop: 12900 },
];
const DEMO_IDS = DEMO_PRODUCTS.map((p) => p.id);

async function seedDemoProduct(p) {
  const url = `https://smartstore.naver.com/demo/products/${p.id}`;
  await apiFetch("/products/batch", {
    method: "POST",
    body: { items: [{ product_id: p.id, mall: p.mall, url, name: p.name, price: p.price }] },
  });
  await new Promise((r) => setTimeout(r, 1100)); // 같은 초 UNIQUE 충돌 회피
  await apiFetch(`/products/${encodeURIComponent(p.id)}/prices`, {
    method: "POST",
    body: { price: p.drop },
  });
  await new Promise((r) => setTimeout(r, 1100));
}

async function cleanupDemo() {
  for (const id of DEMO_IDS) {
    try {
      await apiFetch(`/products/${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch (e) {
      console.log(`  ⚠ 데모 삭제 실패 ${id}: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
}

// URL → { mall, id } — MallParser 규칙 축약 재현 (popup 인식값과 일치)
function parseProductId(urlString) {
  try {
    const url = new URL(urlString);
    const host = url.hostname.toLowerCase();
    const pathStr = url.pathname;
    if (host.includes("coupang.com")) {
      const m = pathStr.match(/\/vp\/products\/(\d+)/);
      return m ? { mall: "coupang", id: m[1] } : null;
    }
    if (host.includes("smartstore.naver.com")) {
      const m = pathStr.match(/^\/([a-zA-Z0-9_-]+)\/products\/(\d+)/);
      return m ? { mall: "naver", id: `store:${m[1]}:${m[2]}` } : null;
    }
    if (host.includes("brand.naver.com")) {
      const m = pathStr.match(/^\/([a-zA-Z0-9_-]+)\/products\/(\d+)/);
      return m ? { mall: "naver", id: `brand:${m[1]}:${m[2]}` } : null;
    }
    if (host.includes("oliveyoung.co.kr")) {
      const goodsNo = url.searchParams.get("goodsNo");
      return goodsNo ? { mall: "oliveyoung", id: goodsNo } : null;
    }
  } catch {}
  return null;
}

function findWhale() {
  for (const p of [
    "/Applications/Whale.app/Contents/MacOS/Whale",
    "/Applications/Naver Whale.app/Contents/MacOS/Naver Whale",
  ]) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// 확장 복사본 — 서버 주소를 로컬로 치환 + host_permissions에 로컬 포트 추가
function createExtensionCopy() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "swb-e2e-ext-"));
  fs.cpSync(EXT_DIR, dir, {
    recursive: true,
    filter: (src) => !src.includes("icons_backup_20260803") && !src.includes("make_icons.py"),
  });
  const commonPath = path.join(dir, "common.js");
  let common = fs.readFileSync(commonPath, "utf-8");
  common = common.replace(
    'server: "https://shop-wisebar.onrender.com"',
    `server: "${SERVER}"`
  );
  fs.writeFileSync(commonPath, common);
  const manifestPath = path.join(dir, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  if (!manifest.host_permissions.includes(`${SERVER}/*`)) {
    manifest.host_permissions.push(`${SERVER}/*`);
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return dir;
}

// 프로필 복사본 — 봇 감지 우회 쿠키 유지, 잠금 파일 제거
function createProfileCopy() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "swb-e2e-profile-"));
  if (fs.existsSync(PROFILE_SRC)) {
    fs.cpSync(PROFILE_SRC, dir, { recursive: true });
  }
  for (const f of ["SingletonLock", "SingletonCookie", "SingletonSocket"]) {
    const p = path.join(dir, f);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  return dir;
}

function extIdFromServiceWorkers(context) {
  for (const sw of context.serviceWorkers()) {
    try {
      const u = new URL(sw.url());
      if (u.protocol === "chrome-extension:") return u.host;
    } catch {}
  }
  return null;
}

const parsed = parseProductId(PRODUCT_URL);
if (!parsed) {
  console.error("✗ 상품 URL을 인식하지 못했습니다:", PRODUCT_URL);
  process.exit(1);
}
const PID = parsed.id;

let context = null;
let extCopy = null;
let profileCopy = null;
let seeded = false;

try {
  // ── TC-E2E-001: 서버 /health ──
  const health = await fetch(`${SERVER}/health`, { signal: AbortSignal.timeout(5000) });
  const healthJson = await health.json();
  check("TC-E2E-001 서버 /health ok", healthJson.status === "ok", JSON.stringify(healthJson).slice(0, 120));
  if (healthJson.status !== "ok") throw new Error("서버 /health가 ok가 아님");

  // ── 데모 데이터 주입 ──
  console.log("▸ 데모 데이터 주입…");
  for (const p of DEMO_PRODUCTS) await seedDemoProduct(p);
  seeded = true;
  console.log("✓ 데모 5개 주입 완료");

  // ── 확장 복사본 + 프로필 복사본 생성 ──
  extCopy = createExtensionCopy();
  profileCopy = createProfileCopy();
  console.log(`▸ 확장 복사본: ${extCopy}`);
  console.log(`▸ 프로필 복사본: ${profileCopy}`);

  // ── 브라우저 실행 ──
  const whalePath = findWhale();
  if (!whalePath) throw new Error("웨일(Whale)을 찾을 수 없습니다.");
  console.log(`▸ 웨일: ${whalePath}`);
  context = await chromium.launchPersistentContext(profileCopy, {
    executablePath: whalePath,
    headless: false,
    viewport: { width: 1280, height: 800 },
    args: [
      `--disable-extensions-except=${extCopy}`,
      `--load-extension=${extCopy}`,
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });

  // 확장 ID 확인 (최대 10초)
  let extId = null;
  for (let i = 0; i < 20; i++) {
    extId = extIdFromServiceWorkers(context);
    if (extId) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  check("TC-E2E-001b 확장 로드 (ID 확인)", !!extId, "service worker URL에서 ID 추출 실패");
  if (!extId) throw new Error("확장 ID를 찾지 못했습니다.");

  // ── TC-E2E-002: 상품 페이지 방문 → 가격 추출 → 서버 저장 ──
  console.log("▸ 상품 페이지 방문:", PRODUCT_URL);
  const productPage = await context.newPage();
  await productPage.goto(PRODUCT_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await productPage.waitForTimeout(8000); // 콘텐츠 스크립트 추출 + 서버 업로드 대기

  // 서버 저장 검증 (캡처 업로드 재시도 포함 최대 25초)
  let saved = null;
  for (let i = 0; i < 50; i++) {
    try {
      const p = await apiFetch(`/products/${encodeURIComponent(PID)}`);
      if (p && p.last_price != null) {
        saved = p;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  check("TC-E2E-002 서버에 상품 저장", !!saved, `GET /products/${PID} — last_price 없음`);
  if (saved) {
    check(
      "TC-E2E-003 가격 이력 존재 (price_points ≥ 1)",
      (saved.price_count || 0) >= 1,
      `price_count=${saved.price_count}`
    );
    console.log(`  ▸ 저장 상품: ${saved.name} · last_price=${saved.last_price} · count=${saved.price_count}`);
  }

  // ── 팝업 렌더링 검증 ──
  // 팝업은 active 탭(상품 페이지)을 인식하므로, 상품 탭을 active로 유지한 채 팝업을 백그라운드 탭으로 연다.
  const popupUrl = `chrome-extension://${extId}/popup/popup.html`;
  const popupPage = await context.newPage();
  await popupPage.goto(popupUrl, { waitUntil: "commit", timeout: 30000 });
  await productPage.bringToFront();
  await popupPage.waitForLoadState("domcontentloaded");
  await popupPage.waitForTimeout(6000); // 서버 API + 렌더 대기

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

  check("TC-E2E-004 팝업 상품명 표시", !!dump.currentName, `currentName="${dump.currentName}"`);
  check("TC-E2E-004 팝업 현재가 표시", !!dump.currentPrice, `currentPrice="${dump.currentPrice}"`);
  check("TC-E2E-004 팝업 통계 표시", !!dump.currentStats, `currentStats="${dump.currentStats}"`);
  check("TC-E2E-005 핫딜 5개 표시", dump.deals.length >= 5, `deals=${dump.deals.length}`);
  check("TC-E2E-005 핫딜 비어있음 숨김", !dump.dealEmptyVisible, "dealEmpty가 visible");

  // ── TC-E2E-006: 데모 정리 후 404 ──
  console.log("▸ 데모 데이터 정리…");
  await cleanupDemo();
  let cleaned = true;
  for (const id of DEMO_IDS) {
    try {
      await apiFetch(`/products/${encodeURIComponent(id)}`);
      cleaned = false;
    } catch {}
  }
  check("TC-E2E-006 데모 정리 (404 확인)", cleaned);
  seeded = false;

  // 결과 리포트
  console.log("\n══════════════════════════════════════");
  console.log(`E2E 결과: ${passed} 통과 / ${failed} 실패`);
  if (failures.length) console.log("실패:", failures.join(", "));
  console.log("══════════════════════════════════════");
  process.exitCode = failed > 0 ? 1 : 0;
} catch (e) {
  console.error(`\n✗ E2E 실행 오류: ${e.message}`);
  if (context) await context.close().catch(() => {});
  if (seeded) {
    try {
      await cleanupDemo();
      console.log("✓ 데모 데이터 정리 완료");
    } catch (e2) {
      console.warn(`⚠ 데모 정리 실패: ${e2.message}`);
    }
  }
  process.exitCode = 1;
} finally {
  if (context) await context.close().catch(() => {});
  if (extCopy && fs.existsSync(extCopy)) fs.rmSync(extCopy, { recursive: true, force: true });
  if (profileCopy && fs.existsSync(profileCopy)) fs.rmSync(profileCopy, { recursive: true, force: true });
}
