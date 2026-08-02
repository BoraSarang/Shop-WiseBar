#!/bin/bash
# ============================================================
# build-macos.sh — macOS 빌드/배포/실행 (AGENTS.md 18.3 매핑표)
# 순서: 강제 종료 → 빌드 → ~/Applications 배포 → 실행
# ============================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="${1:-debug}"
APP_NAME="ShopWiseBar"
APP_PATH="$HOME/Applications/$APP_NAME.app"
DERIVED_DATA="$ROOT_DIR/.derivedData"

if [[ "$CONFIG" == "debug" ]]; then
  CONFIG_UPPER="Debug"
elif [[ "$CONFIG" == "release" ]]; then
  CONFIG_UPPER="Release"
elif [[ "$CONFIG" == "clean" ]]; then
  CONFIG_UPPER="Debug"
else
  echo "ERROR: 알 수 없는 설정: $CONFIG (debug|release|clean)" >&2
  exit 1
fi

# --- 1) 강제 종료 (플랫폼 매핑표: pkill + killall + osascript quit) ---
echo "==> 강제 종료"
killall "$APP_NAME" 2>/dev/null || true
pkill -9 -x "$APP_NAME" 2>/dev/null || true
osascript -e "quit app \"$APP_NAME\"" 2>/dev/null || true
sleep 1

# --- 2) clean 옵션 ---
if [[ "${2:-}" == "clean" ]]; then
  echo "==> 클린: .derivedData 제거"
  rm -rf "$DERIVED_DATA"
fi

# --- 3) xcodegen (project.yml이 소스) ---
echo "==> xcodegen generate"
if [ -f "$ROOT_DIR/project.yml" ] && [ ! -d "$ROOT_DIR/ShopWiseBar.xcodeproj" ]; then
  (cd "$ROOT_DIR" && xcodegen generate)
elif [ -f "$ROOT_DIR/project.yml" ] && [ "$ROOT_DIR/project.yml" -nt "$ROOT_DIR/ShopWiseBar.xcodeproj/project.pbxproj" ]; then
  (cd "$ROOT_DIR" && xcodegen generate)
fi

# --- 4) 빌드 ---
echo "==> xcodebuild ($CONFIG_UPPER)"
xcodebuild \
  -project "$ROOT_DIR/ShopWiseBar.xcodeproj" \
  -scheme "$APP_NAME" \
  -configuration "$CONFIG_UPPER" \
  -derivedDataPath "$DERIVED_DATA" \
  -quiet build

# --- 5) 배포 위치 복사 ---
echo "==> 배포: $APP_PATH"
mkdir -p "$HOME/Applications"
rm -rf "$APP_PATH"
cp -R "$DERIVED_DATA/Build/Products/$CONFIG_UPPER/$APP_NAME.app" "$APP_PATH"

# --- 6) 실행 ---
echo "==> 실행: open $APP_PATH"
open "$APP_PATH"

echo "==> macOS 빌드 완료 ($CONFIG_UPPER)"
