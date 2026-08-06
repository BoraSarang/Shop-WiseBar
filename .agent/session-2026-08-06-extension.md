# 세션 로그 — 2026-08-06 extension (v0.11.0 UI 디자인 시스템)

## 1. 무엇을 (T-99a ~ T-99h)
- **T-99a**: `extension/swb-tokens.css` 신규 — 색상/타이포/간격/라운드/그림자 CSS 변수 단일 소스
- **T-99b**: popup.css 토큰 리팩터 + 잔재(`.alerts/.detail*/.btn-ghost/.watch-name`) 제거 + 헤더 status→본문 `.status-bar` 분리 + 🛠→SVG
- **T-99c**: swb-ui.js shadow `:host` 토큰 주입 + CSS 전면 `var()` 참조 + 기간 탭/목표가/스피너/배지/썸네일 팝업과 통일
- **T-99d**: options/onboarding 인라인 `<style>` → swb-tokens.css 공유
- **T-99e**: FAB `bottom:25vh`→`bottom:24px` 우하단 + 메뉴 2방향(위 x=0 / 왼쪽 x=-60) 재배치 + 패널 FAB 상단 정렬
- **T-99f**: 온보딩 문구 동기화 (메뉴 4가지→6가지, 툴바 설명 정정)
- **T-99g**: 이모지(🛍️🛠🎉🔥) → SVG/제거, `:focus-visible`, `aria-live`
- **T-99h**: manifest v0.11.0 + CHANGELOG + DESIGN.md 3.7 + PLAN 문서
- **T-99i**: 네이버+ 스토어 전환 — "네이버 스마트스토어"→"네이버+ 스토어" 표기 + `smartstore.naver.com`→`shopping.naver.com` 주소 (popup/onboarding/landing/문서/스크립트 일괄) + `common.js`/`manifest.json`/`e2e.js`/`capture.js`에 `shopping.naver.com` 감지 추가 (기존 smartstore 하위 호환 유지)
- **T-99j**: FAB 배치 후속 수정 — T-99e의 우하단(24px) 시도에서 메뉴 원점이 FAB 중심과 23px 어긋나 아이콘이 FAB를 덮고 `y>0` 아이템(찜/사용법)이 화면 밖으로 밀리는 버그 → **25vh 복원**(`.swb-fab` `bottom:calc(25vh-23px)` + `.swb-menu` `bottom:25vh`) + **가격 추이 FAB 바로 왼쪽(x=-60,y=0)** 배치 + **사용법(help) 메뉴 제거 + 아이콘 간격 48px 통일**(위 -60/-108·왼쪽 0/48·아래 60/108) + 온보딩 "화면 1/4 지점"/"메뉴 5가지" 정정 + capture.js 메뉴 펼침 좌표 덤프 추가
- **T-99k**: 연관 상품 배치 안정성 — 로그 분석(`/products/batch` AbortError 3건, UTC 08:47/08:49/09:25, 서버 3~9s 지연) → ①`sendBatchChunk` batch 전 `GET /health` 워밍업(30s) ②`SWB_API`에 `timeoutMs`/`maxAttempts` 옵션(배치 90s·재시도 2회, relations 60s·2회) ③타임아웃 상향 ④실패 배치 오프라인 큐(`pendingRelated`, 최대 10건) → `pollAlerts` 시작 시 `flushPendingRelated` 재전송. 검증: node --check + run-e2e.sh 10/10

## 2. 어떤 플랫폼
- chrome(확장) 전용 — 서버/API/권한 불변. `manifest.json` permissions 구조 그대로

## 3. 빌드/검증 결과
- `node --check` 확장 전체 JS 통과
- `run-e2e.sh` **10/10 통과** — 팝업 렌더(상품명/가격/통계/핫딜 5개) + status="" (status-bar :empty 정상) + 데모 정리
- 스토어 캡처 스크립트 영향 없음 (FAB 좌표 하드코딩 없음)
- T-99i 후 재검증: `node --check` 7파일 + manifest JSON 파싱 OK + `run-e2e.sh` **10/10 재통과**

## 4. 남은 TODO
- 커밋/배포 미수행 (사용자 승인 대기): 변경 파일 10 + 신규 2
- 실기기 육안 확인 권장 — FAB 우하단·메뉴 2방향·기간 탭 통일(웨일 리로드 후)

## 5. 다음 에이전트 전달
- swb-ui.js JS 코드(canvas 차트 `#4dabf7/#888`)는 CSS 변수 미사용 — 의도적(캔버스는 var() 불가)
- `.swb-mi-label.l-above/.l-below` CSS + placeMenuItem의 dir above/below 분기는 이제 미사용(데드 코드) — 향후 정리 가능
- `--swb-danger-soft-2(#fdeeea)`·`--swb-alert-target(#6741d9)`는 shadow 전용 보조 토큰

## 6. 문서 업데이트 목록
- `docs/plans/PLAN_v0.11.0_design-system.md` (신규, 완료 체크)
- `docs/TODO.md` T-99 완료
- `docs/DESIGN.md` 3.7 UI 디자인 시스템 섹션
- `docs/CHANGELOG.md` v0.11.0

## 7. 오프라인 큐 상태
- 해당 없음 (UI 작업, 오프라인 큐 미영향)

## 8. E2E 결과
- `run-e2e.sh` 10/10 통과 (TC-E2E-001~006, 데모 5개 주입/정리 포함)
