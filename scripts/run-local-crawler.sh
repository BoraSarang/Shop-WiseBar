#!/bin/bash
# 로컬 macOS 크롤러 실행 스크립트 (무료 — Render 별도 worker 서비스 대체)
# PLATFORM: server · v0.16.12 (T-123)
#
# 용도:
#   Render web(API)과 분리해 이 맥에서 올리브영/네이버 배치 크롤링을 수행한다.
#   Playwright는 로컬 system Chrome을 사용 (server/.venv + 로컬 Chrome 필요).
#
# 실행 방법:
#   1) 일회성 점검 (1배치만)   : ./scripts/run-local-crawler.sh --once
#   2) 상시 워커 (30s 틱 루프)  : ./scripts/run-local-crawler.sh
#
# 상시 등록 (launchd, 로그인 시 자동 시작):
#   mkdir -p ~/Library/LaunchAgents
#   cp scripts/com.shopwisebar.crawler.plist ~/Library/LaunchAgents/
#   launchctl load ~/Library/LaunchAgents/com.shopwisebar.crawler.plist
#
# 주의:
#   - 이 맥이 꺼져 있으면 크롤링이 멈춘다 (상시 추적 필요 시 24h 켜둠).
#   - 운영 DB와 같은 DATABASE_URL 사용 — server/.env 로드 (gitignore, 시크릿 금지 커밋).
set -euo pipefail

BASE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$BASE/server"

# 로컬 워커 모드 — 운영 crawler_config.enabled와 무관하게 예약 배치를 수행한다 (v0.16.16)
export LOCAL_WORKER=1

# 몰별 배치 크기 — 로컬 기본 30건 (Render 512MB OOM 방지용 운영 기본 2/3건과 분리, v0.16.16).
# 조절: export CRAWLER_BATCH_LIMIT=10 으로 실행하면 10건/배치로 동작한다.
: "${CRAWLER_BATCH_LIMIT:=30}"
export CRAWLER_BATCH_LIMIT
echo "[local-crawler] 배치 크기 ${CRAWLER_BATCH_LIMIT}건/몰"

# .env 로드 (load_dotenv가 app.config에서 실행하지만, 셸 변수로도 명시 노출)

ARGS=()
if [ "${1:-}" = "--once" ]; then
  ARGS+=(--once)
  echo "[local-crawler] 1배치 일회성 실행"
else
  echo "[local-crawler] 상시 워커 시작 (30s 틱 루프)"
fi

exec .venv/bin/python -m crawlers.worker ${ARGS[@]+"${ARGS[@]}"}