#!/bin/bash
# ============================================================
# build_and_run.sh — Shop WiseBar 멀티 플랫폼 빌드 디스패처
# AGENTS.md 18장 표준: pre-hook(보안/만료체크) → 빌드 → 배포 → 실행
# ============================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG="${1:-debug}"
PLATFORM="${2:-macos}"
EXTRA_ARGS=("${@:3}")

usage() {
  echo "사용법: ./build_and_run.sh [debug|release] [macos|ios|android|web|all] [clean] [--device=<name>] [--skip-screenshot] [--help]"
}

# --- 인자 파싱 ---
if [[ "$CONFIG" == "--help" || "$CONFIG" == "-h" ]]; then usage; exit 0; fi

SKIP_SCREENSHOT=0
DEVICE=""
CLEAN=0
for arg in ${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}; do
  case "$arg" in
    clean) CLEAN=1 ;;
    --skip-screenshot) SKIP_SCREENSHOT=1 ;;
    --device=*) DEVICE="${arg#*=}" ;;
    --help) usage; exit 0 ;;
    *) echo "알 수 없는 인자: $arg"; usage; exit 1 ;;
  esac
done

# --- pre-hook: 시크릿 만료 체크 + gitleaks ---
echo "==> [pre-hook] env-expiry-check.sh"
if [ -f "$ROOT_DIR/scripts/env-expiry-check.sh" ]; then
  bash "$ROOT_DIR/scripts/env-expiry-check.sh" || exit 1
else
  echo "    SKIP: scripts/env-expiry-check.sh 없음"
fi

echo "==> [pre-hook] gitleaks detect --no-git"
if command -v gitleaks >/dev/null 2>&1; then
  gitleaks detect --no-git --source "$ROOT_DIR" --exit-code 1 -v 2>&1 | tail -20 || exit 1
else
  echo "    SKIP: gitleaks 미설치 (brew install gitleaks)"
fi

# --- 플랫폼 디스패치 ---
case "$PLATFORM" in
  macos)
    CLEAN_ARG=()
    [ "$CLEAN" -eq 1 ] && CLEAN_ARG=("clean")
    bash "$ROOT_DIR/scripts/build-macos.sh" "$CONFIG" ${CLEAN_ARG[@]+"${CLEAN_ARG[@]}"}
    ;;
  ios|android|web|all)
    echo "ERROR: 플랫폼 '$PLATFORM'는 아직 미지원 (현재 macOS 전용 프로젝트)" >&2
    exit 1
    ;;
  *)
    echo "ERROR: 알 수 없는 플랫폼: $PLATFORM" >&2
    usage
    exit 1
    ;;
esac

# --- post-hook: 스크린샷 (기본 자동) ---
if [ "$SKIP_SCREENSHOT" -eq 0 ] && [ -f "$ROOT_DIR/scripts/screenshot.sh" ]; then
  bash "$ROOT_DIR/scripts/screenshot.sh" macos "v0_1_after_build"
fi

echo "==> 완료: $CONFIG / $PLATFORM"
