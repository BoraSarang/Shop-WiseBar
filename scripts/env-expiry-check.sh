#!/bin/bash
# ============================================================
# env-expiry-check.sh — .env.example 시크릿 만료 체크 (AGENTS.md 10장)
# 형식: KEY=VALUE # expires: YYYY-MM-DD
# 30일 이내: WARN / 만료: ERROR(exit 1) → 빌드 중단
# ============================================================
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_EXAMPLE="$ROOT_DIR/.env.example"

if [ ! -f "$ENV_EXAMPLE" ]; then
  echo "    SKIP: .env.example 없음"
  exit 0
fi

TODAY=$(date +%s)
FAIL=0

while IFS= read -r line; do
  case "$line" in
    \#*|"") continue ;;
  esac
  EXPIRES=$(echo "$line" | sed -n 's/.*# expires: \([0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}\).*/\1/p')
  [ -z "$EXPIRES" ] && continue

  KEY=$(echo "$line" | cut -d= -f1 | xargs)
  EXPIRE_TS=$(date -j -f "%Y-%m-%d" "$EXPIRES" "+%s" 2>/dev/null) || { echo "    WARN: $KEY 만료일 형식 오류 ($EXPIRES)"; continue; }
  DIFF_DAYS=$(( (EXPIRE_TS - TODAY) / 86400 ))

  if [ "$DIFF_DAYS" -lt 0 ]; then
    echo "    ERROR: $KEY 만료됨 ($EXPIRES) — .env.example 갱신 필요"
    FAIL=1
  elif [ "$DIFF_DAYS" -le 30 ]; then
    echo "    WARN: $KEY ${DIFF_DAYS}일 후 만료 ($EXPIRES)"
  fi
done < "$ENV_EXAMPLE"

[ "$FAIL" -eq 1 ] && echo "    → 빌드 중단: 만료된 시크릿 존재"
exit $FAIL
