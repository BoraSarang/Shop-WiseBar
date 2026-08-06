#!/bin/bash
# run-e2e.sh — 똑바(Shop WiseBar) 확장 E2E 자동 검증 (T-98)
#
# 플로우:
#   1. 로컬 uvicorn 기동 (임시 SQLite DB — 운영 DB 오염 방지)
#   2. /health 대기
#   3. e2e.js 실행 (Whale + 확장 + 실제 상품 페이지 + 팝업 검증)
#   4. 서버 종료 + 임시 파일 정리 (trap으로 실패 시에도 보장)
#
# 사용법: ./scripts/e2e/run-e2e.sh [상품URL]
#   기본 상품URL: 올리브영 상세 페이지 (네이버는 자동화 접속 시 429 봇 차단 가능성)
#   포트 변경: SWB_E2E_PORT 환경변수 (기본 8765 — 8000은 타 프로젝트 점유)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SERVER_DIR="$ROOT/server"
E2E_DIR="$ROOT/scripts/e2e"
PORT="${SWB_E2E_PORT:-8765}"
PYTHON="$SERVER_DIR/.venv/bin/python"

if [ ! -x "$PYTHON" ]; then
  echo "✗ 서버 가상환경 없음: $PYTHON"
  echo "  server/.venv 설치 필요 (server/README 참고)"
  exit 1
fi

# ── 임시 DB ──────────────────────────────────────────
TMP_DB="$(mktemp -t swb-e2e-XXXXXX).db"
SERVER_PID=""

cleanup() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -f "$TMP_DB" "$E2E_DIR/.e2e-server.log"
}
trap cleanup EXIT INT TERM

# ── 서버 기동 ────────────────────────────────────────
echo "▸ E2E 서버 기동 (포트 $PORT, 임시 DB)…"
# (cd ... && uvicorn) 서브셸로 띄우면 $!가 서브셸 PID가 되어 종료되지 않음.
# exec로 서브셸을 uvicorn으로 대체 → $!가 실제 서버 PID가 됨 (cleanup에서 정상 종료).
(cd "$SERVER_DIR" && exec env DATABASE_URL="sqlite:///$TMP_DB" .venv/bin/uvicorn app.main:app \
  --host 127.0.0.1 --port "$PORT" --no-access-log \
  >"$E2E_DIR/.e2e-server.log" 2>&1) &
SERVER_PID=$!

# /health 대기 (최대 30초)
OK=0
for _ in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
    OK=1
    break
  fi
  sleep 1
done
if [ "$OK" != "1" ]; then
  echo "✗ E-E2E-SRV-1001: 서버 /health 응답 없음 (30초 경과)"
  exit 1
fi
echo "✓ 서버 준비 완료"

# ── E2E 실행 ─────────────────────────────────────────
echo "▸ E2E 실행…"
(cd "$E2E_DIR" && SWB_E2E_PORT="$PORT" node e2e.js "$@")
RESULT=$?

echo ""
if [ "$RESULT" -eq 0 ]; then
  echo "✓ E2E 전체 통과"
else
  echo "✗ E2E 실패 (exit=$RESULT)"
fi
exit "$RESULT"
