// cleanup.js — 데모 데이터 수동 정리 (capture.js가 비정상 종료되어 demo 상품이 남았을 때)
// 사용법: node cleanup.js
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

const DEMO_IDS = [
  "demo:hdmi:1",
  "demo:stand:2",
  "demo:key:3",
  "demo:mouse:4",
  "demo:light:5",
];

let deleted = 0;
for (const id of DEMO_IDS) {
  try {
    await apiFetch(`/products/${encodeURIComponent(id)}`, { method: "DELETE" });
    deleted++;
    console.log(`✓ 삭제: ${id}`);
  } catch (e) {
    console.warn(`⚠ 삭제 실패(없거나 오류): ${id} — ${e.message}`);
  }
}
console.log(`완료: ${deleted}/${DEMO_IDS.length} 데모 상품 정리`);
