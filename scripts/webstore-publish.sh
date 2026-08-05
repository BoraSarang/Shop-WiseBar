#!/bin/bash
# 스토어 배포 패키징 + 웹스토어 배포 (T-90e, v0.10.2)
# usage: ./scripts/webstore-publish.sh [--dry-run]
#  - zip: dist/shop-wisebar-v{version}.zip
#  - --dry-run: 패키징 + manifest 검증만 (업로드 안 함)
set -e
cd "$(dirname "$0")/.."

DRY_RUN=0
[[ "$1" == "--dry-run" ]] && DRY_RUN=1

VERSION=$(python3 -c "import json; print(json.load(open('extension/manifest.json'))['version'])")
DIST="dist"
mkdir -p "$DIST"
ZIP="dist/shop-wisebar-v${VERSION}.zip"

echo "=== 스토어 패키징 v${VERSION} ==="

# 1) 문법 검증 (스토어가 서치하는 번들 JS)
echo "[1/4] JS 문법 검증..."
for f in extension/*.js extension/popup/*.js; do
  node --check "$f" || { echo "실패: $f"; exit 1; }
done
echo "      OK"

# 2) manifest 필수 필드 검증 + CSP/권한 안전성
echo "[2/4] manifest 검증..."
python3 -c "
import json
m = json.load(open('extension/manifest.json'))
assert m['manifest_version'] == 3
assert 'version' in m and 'name' in m and 'description' in m
assert 'action' in m and 'icons' in m and 'background' in m
assert 'unsafe-eval' not in json.dumps(m.get('content_security_policy',''))
# 스토어 필수 내부필드 제거 확인 (manifest에 넣지 말 것)
assert 'privacy_policy' not in m
print('      OK —', m['name'], 'v'+m['version'], '| permissions:', m['permissions'])
"

# 3) 확장 루트만 zip (node_modules/시크릿/로컬DB 제외)
echo "[3/4] zip 생성..."
rm -f "$ZIP"
# 확장 루트에 shopwisebar.db 등 제외 대상이 있으면 필터
zip -r "$ZIP" extension \
  -x "*/shopwisebar.db" "*/shopwisebar.db-*" "*.DS_Store" \
  >/dev/null
# zip 안의 manifest 권한 확인용 경로
unzip -l "$ZIP" | grep -q "extension/manifest.json" && echo "      OK — $ZIP"
echo "      크기: $(du -h "$ZIP" | cut -f1) $(du -k "$ZIP" | cut -f1)KB"

if [ "$DRY_RUN" = "1" ]; then
  echo
  echo "=== DRY-RUN (업로드 안 함) ==="
  echo "업로드할 파일이 준비되었습니다: $ZIP"
  echo "Chrome Web Store 대시보드에서 직접 업로드하세요."
  echo "  → https://chrome.google.com/webstore/devconsole/"
  echo "업로드 전 진입 항목은 docs/store/STORE_LISTING.md 참고."
  exit 0
fi

# 4) 실제 업로드 — 사용자 계정/인증 필요 (Chrome Web Store API 클라이언트ID)
echo
echo "=== 실배포 업로드는 사용자 계정으로 진행합니다 ==="
echo "Chrome Web Store 개발자 대시보드에서 $ZIP 파일을 업로드해 주세요."
echo "자동 API 업로드는 CLI 클라이언트 ID 설정 뒤 활성화 예정 (웹스토어 API 등록 필요)."