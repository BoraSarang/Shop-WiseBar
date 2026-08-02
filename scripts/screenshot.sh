#!/bin/bash
# ============================================================
# screenshot.sh — 플랫폼별 스크린샷 수집 (AGENTS.md 7.6)
# usage: ./scripts/screenshot.sh [macos|ios|android|web] [이름]
# 저장: docs/screenshots/{platform}/v{버전}_{이름}.png
# ============================================================
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PLATFORM="${1:-macos}"
NAME="${2:-v0_1_screen}"

mkdir -p "$ROOT_DIR/docs/screenshots/$PLATFORM"
OUT="$ROOT_DIR/docs/screenshots/$PLATFORM/${NAME}.png"

case "$PLATFORM" in
  macos)
    # 전체 화면 캡처 (메뉴바 포함). 특정 영역 필요 시 sips로 크롭 가능.
    screencapture -x -T 1 "$OUT"
    ;;
  ios)
    DEVICE="${3:-}"
    if [ -z "$DEVICE" ]; then
      echo "ERROR: iOS는 디바이스 지정 필요: $0 ios <device> [name]" >&2
      exit 1
    fi
    xcrun simctl io "$DEVICE" screenshot "$OUT"
    ;;
  android)
    adb exec-out screencap -p > "$OUT"
    ;;
  web)
    echo "SKIP: Web은 Playwright screenshot 필요 (P4 이후)" >&2
    exit 0
    ;;
  *)
    echo "ERROR: 알 수 없는 플랫폼: $PLATFORM" >&2
    exit 1
    ;;
esac

echo "저장: $OUT"
