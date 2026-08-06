# 똑바(Shop WiseBar) 작업 추적

> 재구성 v0.3.0 시작 (2026-08-03). 상태: 🔵 진행 / ✅ 완료 / ⏸ 보류

## T-96 — 웨일 스토어 실등록 (무료, 우선 진행) (v0.10.x) — 🔵 진행
- [ ] **T-96a**: 스크린샷 준비 (1280×800, 실제 실행 화면 2장 이상 — Chrome/Whale에서 확장 로드 후 캡처)
- [ ] **T-96b**: zip 패키징 + 리스팅 자료 확정 (STORE_LISTING.md 재사용)
- [ ] **T-96c**: 웨일 개발자 등록(네이버 로그인, 무료) + 새 확장앱 업로드 + 리뷰 요청
- [ ] **T-96d**: 심사 통과 확인 + README에 웨일 스토어 링크 반영

## T-97 — Chrome Web Store 실등록 ($5, 최하위 보류) (v0.10.x) — ⏸ 보류 (추후 진행)
> 우선순위 최하위 — 웨일 무료 등록 완료 후 여유가 있을 때 진행. 일회성 등록 수수료 $5 필요.
- [ ] **T-97a**: 개발자 등록 ($5 지불) + 새 항목 업로드
- [ ] **T-97b**: 리스팅 입력 (STORE_LISTING.md) + 심사 제출
- [ ] **T-97c**: 심사 통과 + README 링크 반영

## T-95 — 코드 리뷰: 버그 수정 + 리팩토링 (v0.10.4 후속) — ✅ 완료 (2026-08-06)
- [x] **T-95a**: 배치 `_apply_price` — pending Product 재조회 버그 수정 (autoflush=False에서 None → 500). 실제 충돌 테스트 추가 (test_batch_conflict.py 2건)
- [x] **T-95b**: `upload_price` vs `_apply_price` 가격 저장 로직 중복 → 코어 통합 (captured_at 파라미터로 재시도 지원)
- [x] **T-95c**: `get_alerts` N+1 제거(selectinload, 12→8쿼리) + version 중복(0.2.0→config APP_VERSION) + 회귀(32건) + CHANGELOG

## T-93 — 일괄 업로드 API + 확장 배치 전환 (v0.10.4) — ✅ 완료 (2026-08-06)
- [x] **T-93a**: 서버 `POST /products/batch` 라우터 + schema — 단일 트랜잭션 upsert+price
- [x] **T-93b**: 확장 `uploadRelatedItems` → 배치 청크 전환 (80요청 → 2~4요청)
- [x] **T-93c**: pytest batch + 기존 24건 회귀 + CHANGELOG

## T-94 — DB 연결 풀 (v0.10.4) — ✅ 완료 (2026-08-06)
- [x] **T-94a**: `database.py` PostgreSQL QueuePool + pool_pre_ping (SQLite 유지)
- [x] **T-94b**: pytest 회귀 + CHANGELOG

## T-91 — 서버 운영 개선: 구조적 로깅 + /health 강화 + 운영 문서 (v0.10.3) — ✅ 완료 (2026-08-06)
- [x] **T-91a**: `app/logging_setup.py` — 로거 + 요청 미들웨어(메서드/경로/상태/ms) + 예외 핸들러(E-SRV-GEN-1001) + main.py 적용
- [x] **T-91b**: `/health` 강화 — DB SELECT 1 + started_at + version + indexes
- [x] **T-91c**: `docs/ops/README.md` — Render 배포·로그 보기·모니터링 방법
- [x] **T-91d**: pytest + CHANGELOG 반영 (test_health 강화, 요청 로그 캡처 테스트 추가)

## T-92 — 성능 백로그: 알림 폴링·추천 쿼리 점검 (v0.10.3) — ✅ 완료 (2026-08-06)
- [x] **T-92a**: `GET /devices/{id}/alerts` 쿼리 점검 — `ix_price_points_prod_cap` 커버 확인, N+1은 찜 수준상 허용
- [x] **T-92b**: EXPLAIN QUERY PLAN — 추천 하락 쿼리 price_points 전체 스캔 발견 → `ix_price_points_captured` 추가 (SCAN→SEARCH)
- [x] **T-92c**: pytest 24건 통과 + CHANGELOG 반영

## T-90 — Chrome Web Store 배포 준비 + 릴리즈 자동화 (v0.10.2) — ✅ 완료 (2026-08-05)
- [x] **T-90a**: permission 최소 권한 재검토 + manifest 갱신 — `tabs` 제거 → `activeTab` (쇼핑몰 host_permissions로 URL 커버)
- [x] **T-90b**: `docs/chrome/PERMISSIONS.md` v0.10.2 대조 갱신
- [x] **T-90c**: `landing/privacy.html` 개인정보 처리방침 작성 + 랜딩 푸터 링크
- [x] **T-90d**: `docs/store/STORE_LISTING.md` — 스토어 설명·카테고리·권한 설명·스크린샷 가이드
- [x] **T-90e**: `scripts/webstore-publish.sh` — 검증+zip 패키징+`--dry-run` (통과), `dist/` gitignore
- [x] **T-90f**: 심사 체크리스트 대조 완료 + CHANGELOG + 커밋 준비
- [x] **T-90g**: GitHub Actions 릴리즈 워크플로우 — `release.yml` 태그(v*) push 시 zip 패키징 + manifest-태그 검증 + GitHub Release 생성

## T-89 — 품질 개선: 서버 테스트 자동화 + DB 인덱스 점검 (v0.10.1) — ✅ 완료 (2026-08-05)
- [x] **T-89a**: pytest + httpx 의존성 (requirements.txt)
- [x] **T-89b**: `server/tests/conftest.py` — TestClient + 임시 SQLite + get_db override
- [x] **T-89c**: `server/tests/test_*.py` — devices/products/relations/recommendations/health (23건)
- [x] **T-89d**: DB 인덱스 점검 + 누락분 INDEX_SQLS 추가 (price_daily_stats 복합, product_relations 복합)
- [x] **T-89e**: CI 서버 pytest job 추가 (validate-extension.yml server-test)
- [x] **T-89f**: 실행·검증 + CHANGELOG + 커밋

## T-88 — 가격 통계·시계열 요약 (v0.10.0) — ✅ 완료 (2026-08-05)
- [x] **T-88a**: 서버 `GET /products/{id}/stats` 라우터 + schema — 7일/30일 min·avg·min_date + 역대 min/min_date. variant 있으면 price_points, 없으면 price_daily_stats(low_price) 집계. `docs/api/ENDPOINTS.md` 갱신
- [x] **T-88b**: 팝업 요약 배너 (popup.js/html/css `trendStats`) — "7일 최저/30일 평균/역대 최저(날짜)" 1줄
- [x] **T-88c**: 플로팅 추이 요약 (swb-ui.js `swb-trend-stats`) — product/prices/stats 3건 병렬
- [x] **T-88d**: 로컬 서버 통합 테스트 — stats 주입 데이터로 "7일 최저 54,500원 · 30일 평균 57,500원 · 역대 최저 54,500원 (26/08/05)" 렌더 확인 + 404/null 케이스. 테스트 데이터/서버 주소 원복
- [x] **T-88e**: manifest v0.10.0 + CHANGELOG + API 문서 + 커밋

## T-87 — README 재작성 + GitHub Pages 랜딩 + GitHub Actions CI/CD (v0.9.9) — ✅ 완료 (2026-08-05)
- [x] **README.md 재작성**: 제품 소개/설치/기능/아키텍처/개발 규약 (기존 2줄 → 확장)
- [x] **GitHub Pages 랜딩 페이지** `landing/`: index.html + style.css (히어로/기능 6/지원 몰/CTA). 아이콘은 Actions 배포 시 extension/icons 복사
- [x] **Actions**: `deploy-pages.yml`(Pages 배포) + `validate-extension.yml`(node --check + manifest 검증)
- [x] **Pages 활성화**: REST로 Pages 생성 → `build_type: workflow` 전환 (configure-pages 실패 원인 해결)
- [x] 검증: Deploy Landing Page success + pages-build-deployment success + Validate Extension success + https://borasarang.github.io/Shop-WiseBar/ HTTP 200 + icon48 HTTP 200

## T-86 — 옵션 페이지 서버 장애 안내 + GitHub 릴리즈 링크 + Edge 로드 확인 (v0.9.8) — ✅ 완료 (2026-08-05)
- [x] **서버 주소 변경 불가 유지**: `common.js` SWB_CONFIG 단일 관리. 업데이트 시 자동 반영되므로 사용자에게 주소 변경 요청 없음
- [x] **서버 접속 실패 안내**: 옵션 페이지 `/health` 실패 시 "서버에 접속할 수 없습니다. 문제가 있는지 확인해 보세요." err-box + **새 버전 확인(GitHub 릴리즈)**·**GitHub 저장소** 링크 (options.html err-box/btn-link, options.js loadServerStatus)
- [x] 검증: 정상→errBox none+연결됨, `/health` 차단→errBox block+E-EXT-NET-1001
- [x] **Edge 로드 확인**: Microsoft Edge Profile 1에 `/Users/lee/Documents/Apps/Shop WiseBar/extension` unpacked 로드 확인 (ID dmdgnfaihmeagfopdabippjnbgngafhj) — Edge 관련 T-64 보류 항목 종료

## T-85 — 플로팅 찜 목록 삭제 버그 + 가격 추이 목표가 행 숨김 수정 (v0.9.7) — ✅ 완료 (2026-08-05)
- [x] **찜 목록 관리 삭제 버그 수정**: `renderWatchList`가 스코프 밖 `deviceId`를 참조하는 `deleteWatch(deviceId, ...)` 호출 → ReferenceError → 삭제 무시. `deleteWatch(productId)`로 변경 + 내부에서 `getDeviceId()` 직접 조회 (swb-ui.js:1244,1282)
- [x] **가격 추이 찜 해제 시 목표가 행 숨김 버그 수정**: shadow DOM 범용 `.hidden{display:none}` 규칙 부재 → `.swb-target-row.hidden{display:none}` (swb-ui.js:136), 함께 쓰이는 `.swb-related.hidden{display:none}` (swb-ui.js:173) 규칙 추가
- [x] 서버 정상 확인: 로컬 `DELETE /devices/{did}/watches/{pid}` 204. manifest v0.9.7 상승 + `node --check` 전체 통과
- E2E 메모: Playwright `page.evaluate`는 Main World라 확장 content script(Isolated World)의 `chrome.storage` 접근 불가 → 목록 빈 것으로 나오는 것은 테스트 환경 한계. storage 권한은 manifest에 있으므로 실사용 정상

## T-84 — 스크롤 관계 저장 버그 + 핫딜 상단 배치 + 테스트 데이터 정리 (v0.9.6) — ✅ 완료 (2026-08-05)
- [x] **스크롤 연관 카드 관계 저장 버그 수정**: `RELATED_FOUND`가 parentId 없이 호출되어 relations에 저장 안 되던 문제 → content.js에서 parentId 포함, background.js에서 `msg.parentId || null` 전달 (상품 페이지면 저장, 목록 페이지는 미저장 유지)
- [x] **핫딜 섹션 재배치**: 팝업 섹션 순서 current→deals→related (함께 본 상품 5개가 로드돼도 핫딜이 상단에서 항상 보임)
- [x] **로컬 SQLite 테스트 데이터 정리**: rel-*/local-*/coupang:rel-*/coupang:target*/TESTLONGNAME*/coupang:111·222·333 테스트 상품 + 관계 7건 + test-* 디바이스(13)와 watches/alerts/가격제거 → products 530→506, relations 10→0, devices 16→3 (백업 완료, 실제 3개 디바이스 유지)
- [x] `node --check` 전체 통과 + Whale 팝업 sectionOrder `[current, deals, related]` 확인

## T-83 — 전용 디버그 창 + 중앙 로그 통일 (v0.9.3) — ✅ 완료 (2026-08-05)
- [x] `debug.js` 전면 개편 — 모든 로그 `chrome.storage.local["debugLog"]` 중앙 누적 (최대 2000줄 FIFO) + 콘솔 경유
- [x] content script는 storage 대신 `DEBUG_LOG` 메시지로 background 위임 → `sender.tab`로 탭ID/url/몰 태깅 → **다중 탭 로그 통일 관리**
- [x] `debug-view.html/.css/.js` 신규 — 전용 디버그 창(chrome.windows.create popup) 로그 뷰어(색상/자동스크롤/레벨·몰·탭 필터/검색/복사/지우기/일시정지)
- [x] `manifest.json` commands 단축키 `Ctrl+Shift+D` 토글
- [x] popup 내장 디버그 패널 제거 → 🛠 "디버그 창 열기" 버튼 (OPEN_DEBUG 메시지)
- [x] options `debugEnabled` 스위치 유지 (로그 on/off)
- [x] `docs/chrome/MESSAGING.md` — `DEBUG_LOG`/`OPEN_DEBUG` 규약 + `debugLog` 키 명시
- [x] `node --check` 전체 통과

## T-82 — Chrome 디버그 모드 (경량, 옵션 A) — ✅ 완료 (2026-08-05, T-83으로 대체)
- [x] `extension/debug.js` — `DebugLogger` 래퍼 (레벨 [DEBUG]/[INFO]/[WARN]/[ERROR] + [PERF])
- [x] `background.js`/`content.js` console.* 8곳 → DebugLogger 교체 (동작 영향 없음)
- [x] 콘텐츠 스크립트 추출 시간 `[PERF]` 로그 (100ms 예산, content.js EXTRACT)
- [x] 옵션 페이지에 디버그 패널 표시 토글 → `chrome.storage.local` `debugEnabled` + 팝업 화면 로그 덤프 (헤더 토글 버튼은 로딩 깨짐으로 제거)
- [x] manifest에 `debug.js` 스크립트 로드 (background/content/popup/options 공용)
- [x] 서비스 워커 콘솔 동일 포맷 출력 확인 (node --check)

## T-76~T-81 — AGENTS.md v2.1 문서·규약 정비 (P0, 완료 2026-08-04)
> 상위 규칙 v1.9→v2.1 갱신 대응. 모노레포/크로스브라우저(firefox/safari)는 미적용 — chrome+server 단일 유지.
- [x] T-76: `docs/AI_MODELS.json` v2.1 스키마 갱신 (language_lock/cache_policy/vision_support + 모노레포 제거, cache_policy disabled)
- [x] T-77: `AGENTS.local.md` 상위 버전 참조 → v2.1.0-common
- [x] T-78: `.github/pull_request_template.md` → ext/server 전용 템플릿
- [x] T-79: `docs/chrome/PERMISSIONS.md` 권한 정의서 (manifest 대조 완료)
- [x] T-80: `docs/chrome/MESSAGING.md` 메시지 규약 (content↔background 7종 + storage 규약)
- [x] T-81: `docs/api/ENDPOINTS.md` API 명세 (devices/products/watches/alerts/recommendations)
- [x] `docs/plans/PLAN_v2.1_chrome-server.md` 작성 (문서 우선 원칙)

## T-75 — v0.9.2 UI 다듬기 + 목표가 해제 버그 수정 (완료, 2026-08-04)
- [x] **목표가 해제 버그 수정 (서버)**: `PUT /watches`에 target_price가 없으면 기존 값을 그대로 유지해 해제가 안 되던 문제 → 명시적으로 `None` 초기화 (775724a)
- [x] **팝업 목표가 행 디자인 통일**: 힌트 문구 제거 → 상태 라벨(`N원 이하 알림 중`/`목표가 미설정`) + `설정 해제` 버튼(목표가 있을 때 활성) + 컨트롤 우측 정렬 — popup.css/js/html (99cb06a)
- [x] **찜 목록 가격+상태 한 줄**: `watch-price-row` flex — 가격 왼쪽, 상태(품절/목표가) 오른쪽 정렬
- [x] **품절 행 배경**: `.sold-out-row` 연분홍 배경 + hover (팝업 + 플로팅 swb-ui 동일)
- [x] **함께 본 상품 접기**: 힌트 문구 변경 + 헤더 토글(▾/▸) + `.collapsed` — 팝업 + 플로팅
- [x] **아이콘 v2**: `scripts/gen_icon.py` 신규 생성기 → icon16/48/128 PNG 교체
- [~] 실기기 확인 (웨일 v0.9.2 리로드 후 목표가 설정/해제·품절 배경·함께 본 상품 접기) — 사용자 확인 대기

## T-74 — 목표가 알림 + 품절 감지 + 추천/추이 UX (v0.9.1 — 완료, 2026-08-04)
- [x] **목표가 알림 (서버)**: Watch.target_price 컬럼 + PUT /watches가 목표가 저장, GET /alerts에 `target_reached` 감지 (직전 가격이 목표가 이상일 때만 1회 — 목표가 이하 유지 중 재캡처는 반복 방지, 목표가 이상 회복 후 재하락 시 재알림)
- [x] **품절 감지 (서버)**: Product.sold_out_at 컬럼 + POST /products/{id}/sold-out (품절 시작/재판매), 가격 캡처 시 품절 자동 해제, GET /alerts에 `sold_out` 알림 (since 이후 품절 시작 시 1회, 품절 상품은 하락/목표가 검사 생략 — 무한 반복 방지)
- [x] **컬럼 마이그레이션**: startup에서 `_ensure_columns` — PostgreSQL `ADD COLUMN IF NOT EXISTS`, SQLite PRAGMA 체크 후 ALTER (create_all은 기존 테이블에 컬럼 추가 안 함)
- [x] **since 경계 버그 수정**: 캡처 시각 초 절단으로 since와 동일하면 재감지 → `<=` 비교로 수정
- [x] **목표가 알림 UI (확장)**: 팝업 현재 상품 섹션 목표가 입력/저장/해제 + 찜 목록/플로팅에 목표가·도달·품절 배지
- [x] **품절 보고 (확장)**: content.js 쿠팡 품절 감지 soldOut 플래그 → background가 sold-out API 호출 (가격 없어도 수집)
- [x] **알림 뷰 타입별 배지**: 목표 도달(보라)/품절(빨강)/하락(파랑)
- [x] **관계 기반 추천 확장**: 팝업 '함께 본 상품' 섹션 (GET /related 재사용, 5개)
- [x] **추이 그래프 UX**: 최저가 점선 표시선 + 하락 구간 파란 굵은 선/상승 회색 + 최저·최고점 마커
- [x] 로컬 E2E: 미달 무알림 → 목표가 도달 target_reached → 이하 유지 반복 방지 → 회복 후 재도달 → 품절 sold_out → since 갱신 재폴링 무반복 → 재판매 자동 해제 → 연속 하락 PASS
- [x] 실서버 E2E: 목표가 9999 저장 + 품절 true/false + 찜 조회 반영 확인 (배포 51d3270/4b63f26 + 확장 8b47533/a2971cc)

## T-73 — Phase 2: 목록/검색 페이지 캡처 (v0.8.0~v0.8.4 — 완료)
- [x] 원인: MallParser.parse가 상품 페이지만 인식 → 검색/목록 페이지는 수집 자체가 안 됨
- [x] common.js: MallParser.detectMall (product/listing 판별, 쿠팡 검색·네이버 쇼핑·스마트스토어·브랜드·올리브영)
- [x] content.js: 목록 페이지에서도 카드 수집 (초기 1회 + 스크롤), extractRelated currentProductID null 허용
- [x] background.js: listing 페이지 방문 감지 → captureRelated (pathname 기준 10분 쿨다운)
- [x] 서버: GET /products 목록 API (검증용)
- [x] 가격 오탐 수정 연쇄: 할부 문구(월 N원) → 네이버 스토어명 → "새 창에서 열림" 잡음 문구 (v0.8.1~v0.8.4)
- [x] 실기기 확인: 쿠팡 검색(엑씨/오리온 등) + 네이버 쇼핑 검색(lemonstar03 30개+) 정상 수집, 상품명/가격 정확 (2026-08-03 사용자 확인)
- [x] **찜 상품 배지 (v0.8.5~v0.8.6)**: 목록/검색 카드 + 상품 상세 이미지에 `★ 찜 N원` 뷰포트 고정 배지 — 이미지 안쪽 상단+8px, 스크롤 추적, 30초 캐시 + 찜 토글 무효화 (2026-08-03 사용자 확인 "어 이게 맞아")
- [x] (백로그 해소) 목록 페이지 찜 배지 — **올리브영 실측 완료 (2026-08-04)**: `getMCategoryList.do`(카테고리) / `getSearchMain.do`(검색) 모두 goodsNo 링크 → MallParser 지원 확인, 카드 LI.flag + A.prd_thumb 구조 → findCard 매칭, 검색 결과에서 실제 `★ 찜 17,010원` 배지 렌더 확인 (A000000185308 이즈앤트리)

## T-72 — 쿠팡 가격 추출 안정화 + 이상값 정리 (v0.7.7 — 완료)
- [x] 원인: 쿠팡 페이지가 정가/쿠폰가/사전구매 할인가를 여럿 노출 → 첫 `%` 매치가 렌더링 순서에 따라 번갈아 캡처 (Z Fold8 2,841,800↔958,800, 밴드톡 22,440↔20,190, Z Fold8 오탐 12,320)
- [x] content.js: `data-price` 속성 우선 추출 (쿠팡 표준 판매가 속성)
- [x] 서버: `DELETE /products/{product_id}/prices/{price}` 관리용 포인트 삭제 API
- [x] 배포 후 원격 오탐 포인트 정리 (Z Fold8 12,320 삭제 — min 958,800 정상화)
- [x] 사용자 실기기 확인 (2026-08-03 — "잘 되는 것 같아")

## T-69 — Render 콜드스타트 대응 (v0.7.1 — 완료)
- [x] 원인 파악: Render 무료 티어 15분 스핀다운 → 다음 요청 30~60초 → E-EXT-NET-1001
- [x] common.js에 `SWB_API` 공용 함수: 타임아웃 45초 + GET 콜드스타트 재시도 2회 + 404 특수 처리
- [x] popup.js/background.js/swb-ui.js 직접 fetch 전부 SWB_API로 통합 (직접 fetch 0건)
- [x] 팝업 초기화 로딩 표시 ("불러오는 중…")
- [x] 사용자 확장 리로드 후 실기기 확인 (Chrome/웨일 — 팝업·찜·추이·알림 정상, 2026-08-03 사용자 확인)
- [x] UptimeRobot 5분 핑 등록 완료 — /health 응답 0.3~0.6초 (콜드스타트 제거 확인)

## T-71 — 팝업 재편 + 플로팅 기능 확장 (v0.7.6 — 완료)
- [x] 팝업 순서: 현재 상품 찜 → 오늘의 핫딜 → 찜 목록
- [x] 알림 내역 팝업 제거 → 플로팅 이동 (메뉴 개수 뱃지)
- [x] 찜 목록 접이식 토글 (팝업)
- [x] 플로팅: 오늘의 핫딜 탭 (기간 토글 1/7/30일) + 알림 내역 탭
- [x] 실기기 확인 (팝업 순서/접이기, 플로팅 핫딜 5개 표시/알림 탭, 2026-08-03 사용자 확인)

## T-70 — 오늘의 핫딜 탭 (T-58 확장, v0.7.2~v0.7.3 — 완료)
- [x] 서버: /recommendations에 drop_percent(할인율%) 추가, 할인율 큰 순 정렬 (days=1/7/30)
- [x] 팝업: '오늘의 핫딜' 섹션 + 기간 토글(1일/7일/30일) + top 5 카드 (▼% 배지, 클릭 시 상품 페이지)
- [x] 성능: N+1 → 윈도우 함수 단일 쿼리 (Neon 59초 → 0.8초) + 복합 인덱스
- [x] 팝업 UX: 헤더 sticky 고정 + 섹션별 로딩 스피너(알림/핫딜/현재상품/찜목록) + 실패 문구
- [x] 플로팅 가격 추이에도 로딩 인디케이터 추가
- [x] 실기기 확인 (Chrome/웨일 팝업 — 핫딜 표시 + 기간 토글 + 상품 클릭, 2026-08-03 사용자 확인)

## T-68 — 가격 로우데이터 dedup + 일별 통계 (v0.6.0 — 완료)
- [x] price_points: 가격 변동 시에만 INSERT (같은 가격 재방문은 로우 생성 없음)
- [x] price_daily_stats 신규 테이블: 일별 open/close/low/high/point_count (UNIQUE product_id+stat_date)
- [x] race 방어: captured_at 초 단위 절단 + IntegrityError catch
- [x] 실기기 실측: 3사 방문 89행 dedup / 해피바스 재방문 point_count 3→5 / 리멤버린 가격 변동 정상 캡처 (2026-08-03 사용자 확인)

## T-67 — 연관 상품 자동 수집 (v0.5 — 완료)
- [x] content.js: EXTRACT_RELATED — 상품 페이지 연관 섹션 카드 추출 (MallParser 규약 재사용, 가격 없어도 등록)
- [x] background.js: captureRelated — 연관 상품 upsert + 가격 업로드 (10개 제한, 메인 캡처 쿨다운 공유)
- [x] 스크롤 수집 보정: 자동 스크롤 제거 → 사용자 스크롤 시 새로 로드된 카드만 재수집 (RELATED_FOUND, 600ms 디바운스, 이중 중복 방지)
- [x] SPA 이동 캡처: webNavigation.onHistoryStateUpdated (800ms 딜레이) — 올리브영 클릭 이동 확인 (A000000167392 22,950원)
- [x] 올리브영 전용 추출: CurationItem div 카드 → 이미지 URL goodsNo 파싱 (`A(\d+)ko\.jpg`) — 스크롤 후 2→22개
- [x] 가격 오매치 수정: `\d{1,3}(?:,\d{3})*` + 1,000~5,000만원 필터 — 쿠팡 12,9009,670 오탐 해결
- [x] 실기기 실측 완료: 쿠팡 42 / 네이버 41+11(롯데웰푸드) / 올리브영 22 = 총 116개 등록 (2026-08-03 사용자 확인)
- [x] Phase 2: 목록/검색 페이지 캡처 (쿠팡 검색 결과, 네이버 쇼핑 등) — **T-73에서 완료 (v0.8.0~v0.8.4)**
- [x] Phase 3: product_relations 관계 그래프 저장 — **v0.9.0 완료 (2026-08-04)**: 상품 페이지 연관 카드를 관계로 저장(weight 강도, 무방향 합산), GET /products/{id}/related + 플로팅 추이 '함께 본 상품' 섹션

## T-65 — 가격 통계·추적자·방문 유도 (v0.4.0 — 완료)
- [x] 서버: ProductOut에 min_price/avg_price/price_count/watch_count 추가 (전 기록 집계)
- [x] 서버: WatchOut에 last_checked_at 추가
- [x] 팝업: 현재 상품 '역대 최저가'/'평균보다 저렴' 배지 + 통계 표시
- [x] 플로팅 패널: 가격 추이에 동일 배지 표시
- [x] 배지 3상태 개선 (기록 3개 미만 → '데이터 쌓이는 중' 안내, 오탐 방지)
- [x] 알림: 할인율 % 타이틀/메시지 강조
- [x] 찜 목록(팝업/플로팅): 3일 이상 미캡처 상품 '확인 필요' 배지 — 방문 캡처 유도
- [x] 실기기 확인 (수집/배지/찜 — 2026-08-03 사용자 확인)

## T-66 — 알림 실기기 테스트 (완료 — v0.6.1)
- [x] 찜 → 가격 하락 시뮬레이션 → 5분 내 브라우저 알림 ('가격 N% 내려갔습니다!' 확인) — 크롬/웨일 각 1건
- [x] 알림 클릭 → 상품 페이지 오픈 확인
- [x] 알림 내역(팝업)에 기록 확인
- [x] 알림 폴링 버그 발견·수정: since 분기에서 직전 가격을 since 이전으로만 한정 → 찜 후 첫 하락 미감지 (v0.6.1)

## T-60 — 익스텐션 뼈대 (완료)
- [x] manifest.json MV3 (권한: storage/alarms/notifications/tabs, host_permissions)
- [x] 기기ID 발급/등록 (background, crypto.randomUUID)
- [x] MallParser JS 포팅 (common.js — content/background 공용)
- [x] content.js 가격 추출 (네이버 상품 가격 패턴/쿠팡 % 패턴/올리브영 data-qa·tx_num)
- [x] 탭 이벤트 → 업로드 (쿨다운 10분, source=extension)
- [x] 실기기 검증 (Chrome 개발자 모드 로드 + 상품 페이지 방문 → 서버 DB 확인) — ✅ 완료 (2026-08-05, 사용자 확인)
- [x] 아이콘 생성 (make_icons.py — 남색 원 + 하락 화살표)

## T-61 — 팝업 UI (완료)
- [x] 현재 상품 찜/찜 해제/목표가 (팝업 + 서버 watches)
- [x] 찜 목록 (썸네일/가격/목표가/해제)
- [x] 가격 추이 그래프 (캔버스 라인차트)
- [x] **플로팅 버튼 + 가격 추이 패널 (content script, shadow DOM)** — 상품 페이지 우하단, 클릭 시 추이
- [x] 실기기 확인 (2026-08-03 사용자 확인)

## T-62 — 알림 (완료 — 코드 완성, 실기기 확인은 T-66에서 모음)
- [x] chrome.alarms 폴링 (5분)
- [x] chrome.notifications (price_dropped/target_reached)
- [x] 알림 클릭 → 상품 페이지 오픈 (storage.session 매핑)
- [x] since 커서 중복 방지

## T-63 — 서버 (완료)
- [x] source=extension 허용 (스키마 주석 갱신 — String(16) 자유값)
- [x] 올리브영 Playwright 크롤러 (UA 필수 실측 반영, 39,900원 수집 성공)
- [x] 크롤러 워커 정리 (worker.py → oliveyoung.run_once)
- [x] E2E 검증: device → upsert → price(extension) → watch → alerts(하락/목표가/증분)

## T-64 — 마무리 (진행)
- [x] Whale(웨일) MV3 로드 확인 — 2026-08-03 사용자 실기기 테스트 완료 (수집/배지/찜 정상)
- [x] Edge 확인 — ✅ 완료 (2026-08-05, v0.9.8): Profile 1 unpacked 로드 확인 (확장 ID dmdgnfaihmeagfopdabippjnbgngafhj → /Users/lee/Documents/Apps/Shop WiseBar/extension)
- [x] 옵션 페이지 (서버 URL 설정) — ✅ 종료 (2026-08-05, v0.9.8): 서버 URL 변경 불가 확정 — SWB_CONFIG 단일 관리, 업데이트로 자동 반영. 서버 장애 시 GitHub 릴리즈 링크로 대체
- [x] 테스트 기록: docs/tests/v0.3_crawler_poc.md 작성 완료
- [x] 커밋

## 백로그 — 다음 회차 (일정 미정, 아이디어 기록)
- [x] **핫딜 탭/추천 강화** — **v0.8.26 완료**: 하락 상품 부족 시 역대 최저가 갱신 상품(reason=low) 채움 + variant 중복 1건 + 팝업/플로팅 '최저가' 배지 (v0.8.28) (2026-08-04)
- [x] Phase 2: 목록/검색 페이지 캡처 (쿠팡 검색 결과, 네이버 쇼핑 등) — T-73 완료
- [x] Phase 3: product_relations 관계 그래프 저장 — **v0.9.0 완료 (2026-08-04)**: 상품 페이지 연관 카드를 관계로 저장(weight 강도, 무방향 합산), GET /products/{id}/related + 플로팅 추이 '함께 본 상품' 섹션
- [x] 알림 테스트 일괄 진행 — **2026-08-04 완료**: variant=None 품절 잔존(9,880원)이 알림 하락 오탐을 만드는 문제 발견 → v0.8.27 품절 price-container 스킵 + DELETE variant 정밀 삭제 + 오리온 정리, 정상 하락(10,600→10,520)만 감지 확인
- [~] 공식 API 연동 (옵션 C) — **제외 결정 (2026-08-03, 사용자)**: 쇼핑몰 계약/심사 불필요, 익스텐션 수집으로 충분

## 완료 이력
- 2026-08-03: 맥 메뉴바(v0.2.x) 전부 폐기 — git 히스토리로만 보존
