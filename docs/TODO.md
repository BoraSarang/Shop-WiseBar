# 똑바(Shop WiseBar) 작업 추적

> 재구성 v0.3.0 시작 (2026-08-03). 상태: 🔵 진행 / ✅ 완료 / ⏸ 보류

## T-127 — 매니저 로컬 배치 실행기 + 인사이트 리스트/그리드 + AI 보류 (v0.16.16) — 🔵 진행 (2026-08-14)
> 사용자 결정: ①로컬 배치는 **수동 실행/종료** (매니저가 Process 직접 제어), ②매니저 앱 로그인 시 자동 실행은 **설정에 토글** 추가, ③AI 도입은 **보류**하고 관리자 기능 우선.
> 상세: `docs/plans/PLAN_v0.16.16_manager.md`
- [x] **T-127a** PLAN_v0.16.16 작성 + TODO 등록 + AI 보류 문서 기록 (AI_MODELS.json/CHANGELOG)
- [x] **T-127b** 서버: `GET/POST /admin/crawl/targets` 수집 대상 페이지 (프리셋 네이버 메인·올리브영 랭킹 + 커스텀 URL) (+ tests)
- [x] **T-127c** 서버: `/admin/insight` 상품 메타(name/image/url/mall) 조인 (+ tests)
- [x] **T-127d** 로컬 크롤러: worker 목록 페이지 파싱 (target URL → 상품 카드 추출 → 신규 등록/기존 갱신)
- [x] **T-127e** macOS: SettingsView — 로그인 자동 실행 토글(SMAppService) + 서버 오버라이드 UI
- [x] **T-127f** macOS: 로컬 배치 섹션 — Process 시작/중지/1회 실행 + 상태·로그 표시
- [x] **T-127g** macOS: InsightView 상품 카드 그리드/리스트 토글
- [ ] **T-127h** 검증: pytest + xcodebuild + 로컬 크롤러 --once 실데이터 + ~/Applications 배포 + 커밋/push

## T-126 — 똑바 매니저 관리 고도화 (P0/P1/P2) (v0.16.15) — ✅ 완료 (2026-08-14)
> 사용자 승인: 매니저 관리 항목 4개 축 전부 선택. P0 수집상품 인사이트+서비스 헬스 → P1 사용자 활동 → P2 가격 동향.
> 상세: `docs/plans/PLAN_v0.16.15_manager.md`
- [x] **T-126a** PLAN_v0.16.15 작성 + TODO 등록 (문서 우선)
- [x] **T-126b** P0 서버: `/admin/health` + `/admin/crawler/summary` (+ tests)
- [x] **T-126c** P0 서버: `/admin/products/top` + `/admin/products/{id}` (+ tests)
- [x] **T-126d** P0 macOS: HealthView + Insight/Stats 확장 + APIClient/AppModel
- [x] **T-126e** P1 서버: 스키마+heartbeat+`/admin/users` (+ tests)
- [x] **T-126f** P1 확장: heartbeat 병합 + 배치 device_id 포함
- [x] **T-126g** P1 macOS: 사용자 화면
- [x] **T-126h** P2 서버: `/admin/price-compare` (+ tests) + macOS 인사이트 확장
- [x] **T-126i** 검증: pytest 전체 + xcodebuild + 운영 실데이터 + 배포(0.16.15) — **완료 (2026-08-14)**: pytest 87건, xcodebuild SUCCEEDED, `/health` v0.16.15 확인(운영), 신규 엔드포인트 6종 실데이터 응답 확인

## T-125 — 네이버 brand 상품 0건 버그 + Browserless 컨텍스트 레이스 수정 (v0.16.14) — ✅ 완료 (2026-08-11)
> 재개 검증(로컬 `--once`) 중 발견 — **naver 배치가 계속 0건**인 원인 수정 + Browserless CDP 연속 상품 처리 실패 수정.
- [x] **T-125a** `crawlers/naver.py` — 후보 쿼리에 `url LIKE '%brand.naver.com%'` 추가. 원인: null smartstore 상품이 candidates 30을 점유 → brand 상품(389건 전체 stale)이 후보에서 영원히 밀림.
- [x] **T-125b** `crawlers/_browser.py` — Browserless는 `contexts[0]` 재사용(상품별 new_context 금지) + `close_context()` 헬퍼 신설. 원인: CDP 컨텍스트 close가 공유 클라우드 세션을 닫아 TargetClosedError.
- [x] **T-125c** 검증: `BROWSERLESS_TOKEN` 미설정(시스템 Chrome 폴백) — oliveyoung 2건 + 네이버 3건(199000·7900·79900원) 전부 수집 (33.7s).
- [ ] **T-125d** 상시 재개는 보류 — Browserless 무료 티어는 연속 세션·새 탭 쿼터 제한 확인. 재개 시 로컬 macOS 크롤러(무료) 또는 Browserless 유료 플랜 중 선택.

## T-124 — Browserless 연동 — 크롤러 Chrome 클라우드 이전 (v0.16.13) — ✅ 완료 (2026-08-11)
> 사용자 요구: Render 512MB 컨테이너 안에서 Chrome이 메모리를 압박해 `/health` 지연·재시작 루프를 일으키는 근본 구조 문제를, **브라우저를 Browserless 클라우드로 이전**해 해결. Browserless Setup Assistant 분석 기반으로 **Path D(기존 Playwright 코드 재포인팅)** 선택. 상세: `docs/plans/PLAN_v0.16.13_browserless.md`
- [x] **T-124a** `.env`(server/, gitignore)에 `BROWSERLESS_TOKEN` 실값 + `.env.example`은 키만 등록 (시크릿 커밋 금지)
- [x] **T-124b** `crawlers/_browser.py` — `BROWSERLESS_TOKEN` 설정 시 `connect_over_cdp(wss://production-sfo.browserless.io/chromium/stealth)` 분기 + 실패 시 기존 로컬 launch 폴백
- [x] **T-124c** `new_context()` — CDP 브라우저는 `browser.new_context(user_agent, locale)` 우선, 미지원 시 `contexts[0]` 재사용 + `set_extra_http_headers` UA 주입 폴백
- [x] **T-124d** 검증: `--once` — **oliveyoung 2건 수집 성공(Browserless stealth로 챌린지 우회)**, naver 0건, token 미설정 폴백 → 시스템 Chrome 정상 (회귀 없음)
- [x] **T-124e** Render web/worker `Environment`에 `BROWSERLESS_TOKEN` 추가 안내 (대시보드, git 무노출)
- [x] **T-124f** 문서: CHANGELOG v0.16.13 / TODO / PLAN_v0.16.13 / session 로그 반영

## T-121 — 크롤러 이력 3상태(성공/실패/상품없음) + 실패 사유 (v0.16.8) — ✅ 완료 (2026-08-10)
> 사용자 요구: 크롤러 응답이 성공/실패만이 아니라 **성공/실패/상품 없음 3상태**여야 하며, 실패면 **실패 사유**를 알고 싶어 함. 현재는 크롤러가 내부적으로 ok/gone/None을 구분하지만 `run_once`가 (attempted, success) 2수로 합산해 gone을 실패로 퉁치고, crawler_runs에 사유도 없음. 상세: `docs/plans/PLAN_v0.16.8_crawler-status.md`
- [x] **T-121a** 서버: `CrawlerRun.gone`(default 0) + `CrawlerRun.error`(nullable text) 모델 + `main.py _ensure_columns` 마이그레이션
- [x] **T-121b** 서버: oliveyoung/naver `run_once` → `(attempted, success, gone, error)` 반환 (fetch None → `{status:None, error:사유}`)
- [x] **T-121c** 서버: `worker._run_batch` — gone/error 저장 + 실패 시 error 기록
- [x] **T-121d** 서버: `admin.crawler_logs` 응답에 gone/error (+ 테스트 — **76건 통과**)
- [x] **T-121e** macOS: `CrawlerLog` gone/error + `CrawlerView.logRow` 3상태 배지(`@ViewBuilder` — 다중 분기 opaque 타입 오류 수정) + 실패 사유 — **xcodebuild BUILD SUCCEEDED**
- [x] **T-121f** 검증: pytest 76건 + xcodebuild 성공 + **운영 실측 — oliveyoung 0/3 `gone=3 failed=0` (상품없음이 실패와 구분됨)**
- [x] **T-121g** 문서: CHANGELOG v0.16.8 / TODO / ENDPOINTS 반영 + 커밋·push(8be379c, 3cc88a7) + 배포(0.16.8 health ok)

## T-120 — 운영 크롤러 브라우저 폴백 (v0.16.3→v0.16.6) — 🔵 진행 (2026-08-10)
> 운영 로그: oliveyoung 10건/naver 5건 전부 실패·0.9초 — Render 컨테이너에 시스템 Chrome 없어 `_get_browser()`의 `channel="chrome"` launch 즉시 실패 + `playwright`가 requirements.txt에 없어 운영 미설치(import 실패가 fetch 실패로 흡수). → Render(linux)가 Playwright 번들 Chromium으로 수집 가능하게 폴백 + 빌드 명령에 playwright 설치.
- [x] **T-120a** 브라우저 실행 폴백: 시스템 Chrome 없으면 playwright 번들 Chromium으로 (chrome → chromium 재시도) — `crawlers/_browser.py` 신규 + oliveyoung/naver 중복 제거
- [x] **T-120b** requirements.txt에 `playwright>=1.49.0` 추가
- [x] **T-120c** Render 빌드 명령/운영 가이드 반영 + **v0.16.4 `render.yaml` 블루프린트로 코드 고정** (빌드 시 `--with-deps chromium` 설치)
- [x] **T-120d** 검증: pytest 75건 통과 + 시스템 Chrome 미설치 시뮬레이션으로 번들 Chromium 올리브영 수집 성공(28,900원) — **v0.16.3 운영 배포에서 번들 이진파일 부재로 실패 재실측 → v0.16.4 빌드 시 설치로 해결**
- [x] **T-120e** 검증: v0.16.5 배포 후 **OOM 재발 없음** (배치 3건 34.8s + `브라우저 리소스 해제 완료`, 운영 로그 00:10 UTC). 진단 로그로 수집 0건 원인 **Cloudflare 챌린지 차단 확정** (body=89자 "잠시만 기다려 주세요... RAY_ID")
- [x] **T-120g** v0.16.6 Cloudflare 대응: Dockerfile에 `playwright install chrome`(실제 Chrome) + `--disable-blink-features=AutomationControlled` + oliveyoung 챌린지 자동 해결 재대기
- [x] **T-120h** 검증: v0.16.6 배포 후 운영 로그 — iframe 확정: `브라우저: 시스템 Chrome` 로드 성공 + Cloudflare 챌린지 통과(body 89→160자). 하지만 0건 지속 → 원인은 **상품 소멸** (로컬 한국 IP 직조회로 확정: og:title="올리브영 온라인몰" + "찾을 수 없음")
- [x] **T-120i** v0.16.7 소멸 상품 재시도 방지: fetch status "gone" 감지(og:title 몰 제목 / "찾을 수 없" / "존재하지 않습니다") + run_once가 last_checked_at 갱신 (1시간마다 0건·143초 무의미 반복 중단)
- [ ] **T-120j** v0.16.7 배포 후 운영 `/crawler/logs` — 수집 0건이 **소멸 상품만** 남고 중단되는지 확인 (배치 소요 크게 감소 예상)

## T-119 — 크롤러 성공/실패 통계 (v0.16.2) — 🔵 진행 (2026-08-10)
> v0.16.1 사용 중 "수집이 0건이네?"(운영 이력 count=0만 표시) → "몇 건 시도 → 몇 건 성공, 몇 건 실패" 표시 요구.
> `crawler_runs.attempted`(시도) 추가 + 크롤러 `run_once` → `(attempted, success)` 반환 + macOS 이력 행 개선. 상세: `docs/plans/PLAN_v0.16.1_macos-crawler.md` v0.16.2 섹션
- [x] **T-119a** 서버: `main.py` 마이그레이션 + `CrawlerRun.attempted`
- [x] **T-119b** 서버: oliveyoung/naver `run_once` → `(attempted, success)`
- [x] **T-119c** 서버: worker.py attempted 기록 + admin logs 응답 attempted/failed
- [x] **T-119d** macOS: CrawlerLog.attempted + CrawlerView "대상 N건 중 성공 M · 실패 K" (+ 옛 응답 호환)
- [x] **T-119e** 검증: pytest 75건 + xcodebuild 성공 + worker 배치 스텁 attempted 반영
- [ ] **T-119f** 문서: CHANGELOG v0.16.2 / ENDPOINTS / TODO 반영 ✅ 반영 / 커밋·push + 운영 배포

## T-118 — macOS 매니저 크롤러 제어/모니터링 화면 (v0.16.1) — 🔵 진행 (2026-08-10)
> v0.16.0(T-117) 서버 크롤러 제어 API를 macOS 똑바 매니저 사이드바 "크롤러" 섹션으로 노출.
> 설정(주기 1/3/6/12/24시·활성화)·즉시 수집 트리거·배치 실행 이력을 화면에서 제어. 상세: `docs/plans/PLAN_v0.16.1_macos-crawler.md`
- [x] **T-118a** macOS: APIClient — `CrawlerConfig`/`CrawlerLog` 모델 + `put`/`post` 헬퍼 + 메서드 4종(config/update/run/logs)
- [x] **T-118b** macOS: AppModel — `Section.crawler` + 설정/이력 상태 + `refreshCrawler()` + 제어 액션
- [x] **T-118c** macOS: App.swift — 사이드바/콘텐츠 스위치 연결 + 하단 버전 동적 표시
- [x] **T-118d** macOS: CrawlerView — 설정 카드(주기·활성화·지금수집) + 실행 이력 리스트(성공/실패·트리거·KST)
- [x] **T-118e** 검증: xcodebuild 성공 + 로컬 서버(0.16.0) 실제 연동 확인(config/logs 로드) + pytest 74건 회귀(서버 변경 없음)
- [ ] **T-118f** 문서: CHANGELOG v0.16.1 반영 ✅ / TODO 반영 ✅ / 커밋·push

## T-116 — 네이버 서버 크롤러 + 크롤러 제어 API (v0.16.0) — 🔵 진행 (2026-08-10)
> 2차 크롤링 검증(ShopWiseBar-Verify) 결과: 네이버 브랜드스토어가 서버 Playwright(headless, 네이버만 성공 실측)로 캡차 없이 이름+가격 수집 가능 → 서버 크롤러 신규 채택.
> 쿠팡은 여전히 Akamai 차단 → 익스텐션 의존 유지. + 크롤러 제어 API(macOS 매니저 연동 전 서버 준비). 상세: `docs/plans/PLAN_v0.16.0_naver-crawler.md`

- [x] **T-116a** 서버: `crawlers/naver.py` 신규 — `fetch(url)`(networkidle+가격 대기 스크롤+body 정규식) + `run_once()`
- [x] **T-116b** 서버: `crawlers/worker.py` — `CRAWLABLE_MALLS` 정의(oliveyoung/naver) + `naver.run_once` 병렬 호출 + 각 크롤러 자사 몰 필터 (공유 쿼리 선점 버그 수정)
- [x] **T-116c** 검증: 로컬 DB 네이버 실상품(롯데웰푸드 브랜드스토어) 10건 갱신 + price_point 반영 확인 (1,000~66,000원)
- [x] **T-117a** 서버: `crawler_runs`/`crawler_config` 테이블 + 시드 (models.py + startup)
- [x] **T-117b** 서버: `worker.py` 30초 틱 재작성 — 주기 실시간 반영 + run_requested 즉시 배치 + 배치 로그 기록 + `--once`
- [x] **T-117c** 서버: `admin.py` — `GET/PUT /admin/crawler/config`(주기 {1,3,6,12,24}시) + `POST /admin/crawler/run` + `GET /admin/crawler/logs`
- [x] **T-117d** 검증: worker --once / PUT 주기 즉시 반영 / POST run 즉시 배치 / crawler_runs 반영 — 실검증 완료 (올리브영 실수집 2건 + trigger=manual + 로그 기록)
- [x] **T-117e** 문서: CHANGELOG v0.16.0 / ENDPOINTS / APP_VERSION=0.16.0 + pytest 회귀 — `tests/test_crawler.py` 8건 + **74건 통과**
- [ ] **T-117f** 커밋·push (macOS 매니저 UI는 다음 단계 — API만 준비)

## T-115 — macOS 관리 앱 "똑바 매니저" (v0.15.0) — 🔵 진행 (2026-08-08)
> 사용자 신규 기능 제안: DB에 쌓인 정보를 Mac 관리 프로그램으로 조회. 대시보드/인사이트/전체·쇼핑몰별·수집 통계 + 공통 핫딜.
> 조회 전용, 인증 없음, 운영 서버(`https://shop-wisebar.onrender.com`) 조회. 디자인은 Music 앱 스타일 네이티브.
> 상세: `docs/plans/PLAN_v0.15.0_admin-macos.md`

- [x] **T-115a** 서버: `/admin/*` 조회 라우터 (overview/trend/malls/collect/insight) + `test_admin.py` 6건 — 전체 pytest **66건 통과**
- [ ] **T-115b** macOS: xcodegen `project.yml` + DesignSystem 토큰(확장 swb-tokens 연동) + APIClient(@Observable AppModel)
- [ ] **T-115c** macOS: Music 앱 스타일 NavigationSplitView 사이드바 + 대시보드(카드+트렌드 차트)
- [ ] **T-115d** macOS: 인사이트/통계(몰별)/수집/공통 핫딜 뷰
- [ ] **T-115e** macOS: 상품 상세 드릴다운(가격 이력·stats·alternatives) (데이터 보유 시)
- [ ] **T-115f** 검증: xcodebuild 성공 + 운영 서버 실데이터 렌더 확인 + 문서/커밋/push

## T-106~T-109 — 데이터 활용 고도화: 크로스몰 비교 + 타이밍 인사이트 (v0.13.0) — ✅ 완료 (2026-08-08)
> 사용자 신규 기능 제안: 여러 쇼핑몰에서 수집한 상품 데이터를 활용해 "이와 비슷한 다른 쇼핑몰 상품"부터 노출.
> 동일상품(정규화명)을 다른 몰 가격과 비교 → "쿠팡이 x% 더 쌈". 상세: `docs/plans/PLAN_v0.13.0_crossmall.md`
> 범위: 크로스몰 최저가 비교(T-106~108) + 구매 타이밍 인사이트(T-109). 품절 복귀(T-110)·트렌드 피드(T-111)는 v0.14.

- [x] **T-106** 서버: `products.normalized_name` 컬럼 + 정규화 서비스 + upsert/백필 자동 계산 (alternatives는 조회 시 동적 매칭 — 별도 테이블/워커 없음)
- [x] **T-107** 서버: `ProductOut.alternatives`(동일상품 다른 몰 가격/워처/URL) + 찜 목록 `?include_alternatives=true`
- [x] **T-108** 확장: 상세 패널 "다른 몰 가격" 섹션 + 찜 목록/팝업 비교 표시
- [x] **T-109** 서버+확장: `stats` `insight_badges`(최저가 도달/추이/평균 대비) + "지금 사도 돼" 배지 강화
- [x] 테스트: pytest normalizer/matching/alternatives/insight + 회귀 + node --check + E2E
- [x] 문서: CHANGELOG v0.13.0 / ENDPOINTS.md alternatives·insight_badges 명세 / manifest 0.13.0

## T-110 — 품절 복귀 알림 (v0.14.0, 이월) — ✅ 완료 (2026-08-08)
> 사용자 신규 기능 제안 확장: 품절됐던 찜 상품이 재판매(가격 캡처 → sold_out 자동 해제)되면 사용자에게 알림.
> 서버: `sold_out` 알림 인프라 기존 존재 (검사는 품절 동안 하락/목표가 당지 생략 — 무한 반복 방지). v0.13.0 머지 후 확장 폴링 부활 로직 작업 예정.

- [x] 서버: `products.back_on_sale_at` 컬럼 + 마이그레이션(SQLite/PG) + `_apply_price` 품절 해제 시 기록 (T-110a)
- [x] 서버: `get_alerts` `back_in_stock` 알림 — back_on_sale_at > since 1회, 최초 폴링 미발생, 복귀 후 하락/목표가 검사 정상 (T-110b)
- [x] 확장: 시스템 알림 "품절 해제" + FAB 알림 히스토리 "재입고" 배지/메시지 (T-110c)
- [x] 테스트: pytest 3건 (복귀 1회/초기 폴링 미발생/복귀-하락 동시) + 회귀 — 총 60건 통과, node --check (T-110d)
- [x] 문서: CHANGELOG v0.14.0 / ENDPOINTS `/alerts` back_in_stock / manifest 0.14.0 / PLAN_v0.14.0_backinstock.md (T-110e)

## T-111 — 주간 트렌드 피드 (v0.14.0, 이월) — ⏸ 보류 (2026-08-08)
> v0.14.0 후속 항목. 기간은 T-110 완료 후 협의.

## T-105 — 공개 핫딜 피드 (확장 전용) (v0.12.3) — ✅ 완료 (2026-08-07)
> 다사자(dasaja.co.kr) 분석 → 모든 사용자의 실측 하락/최저가 상품을 익명 집계해 팝업 "전체 핫딜" 탭에서 노출.
> 프라이버시 유지(기기/제품 ID 미노출), 랜딩 미노출. 다사자의 크라우드 수동 딜과 차별화(실측 최대/하락).

- [x] 서버: `GET /api/v1/deals/public` (익명 집계 + `watchers` + 5분 캐시) — `recommendations.py`
- [x] pytest: 3종 (기기 무관 집계 / watchers=2 / 캐시) + 회귀 44건 통과
- [x] 팝업: `loadDeals` → `/deals/public` 전환 + 탭 "전체 핫딜" + `watchers` "N명이 찜" 배지 (0명 포함)
- [x] 팝업: 핫딜 리스트 내부 스크롤 (`max-height:320px`) — FULL 데이터 시 팝업 전체가 길어지는 것 방지
- [x] 플로팅(FAB) 뷰어: "오늘의 핫딜" → "전체 핫딜", `/deals/public` 전환 + `👀 N명이 찜` 배지
- [x] 플로팅(FAB) 메뉴 재배치: 위쪽 열 전체 핫딜 → 가격 추이 순 (알림은 왼쪽 열)
- [x] 콘텐츠 스크립트 로그 `badge top 12px` 제거
- [x] 문서: CHANGELOG v0.12.3 / ENDPOINTS.md `/deals/public` 명세 반영
- [x] 검증 (미리보기 스크롤 측정: list 706>320, body 600 유지) + 커밋/push

## T-104 — 랜딩 페이지 리뉴얼 (다크 프리미엄 + 웨일 CTA) (v0.12.2) — ✅ 완료 (2026-08-07)
> 웨일 스토어 게재(T-96d)에 맞춰 랜딩을 역동적으로 재구성. 다크 프리미엄 테마 + 스크롤/인터랙션 + 웨일 스토어 설치를 주 CTA로 승격.
- [x] **T-104a**: `landing/assets/style.css` — 다크 프리미엄 전면 재작성 (배경 오브, 그라디언트 텍스트, 카드 호버, reveal 애니메이션, 반응형)
- [x] **T-104b**: `landing/index.html` — 섹션 재구성 (히어로 샷·기능 6·데모 갤러리 4·실사용 단계 4·쇼핑몰·CTA) + 웨일 스토어 주 CTA 승격 + 설명문 다듬기
- [x] **T-104c**: `landing/assets/app.js` 신규 — 네비 스크롤 상태, IntersectionObserver 페이드업, 배경 오브 마우스 패럴택스, prefers-reduced-motion 존중
- [x] **T-104d**: `landing/assets/img/` — 스크린샷(shop-wisebar-01~05) + 온보딩(step-01~05) 사본 배치
- [x] **T-104e**: 검증 — node --check + 로컬 서버 스냅샷 (데스크톱 1280/모바일 390) + 콘솔 오류 0 + 가로 오버플로 없음 + reveal 15/15

## T-103 — 서버 API 지연 개선 (SQLite WAL) + 성능 진단 (v0.12.3) — ✅ 완료 (2026-08-07)
> 사용자 실사용 로그 분석: `/alerts`/`watches` 3~6초, `/products/batch` 최대 59초 지연. 로컬 실측으로 batch 40개 단일 0.14초/동시 부하 평균 95ms로 **코드 병목 아님** 확인. 주원인은 Render 무료티어 + Neon 서버리스 콜드스타트/슬립. 로컬 SQLite 동시 쓰기 Lock 대기 완화를 위해 WAL + busy_timeout(3s) 적용 (운영 PG엔 무해, `is_sqlite` 가드).
- [x] **T-103a**: `server/app/database.py` — SQLite WAL 모드 + `busy_timeout=3000` + `synchronous=NORMAL` (`event.connect` PRAGMA)
- [x] **T-103b**: `.gitignore` — `server/*.db-shm`/`server/*.db-wal` 추가 (WAL 부산물 추적 방지)
- [x] **T-103c**: 성능 실측 — batch 40개 단일 0.14s / 동시성 8스레드 batch 평균 95ms 최대 107ms (운영 PG선 동시 쓰기 Lock 없음) → 결론: 콜드스타트가 주원인
- [x] **T-103d**: CHANGELOG v0.12.3 (T-103) + 세션 로그

## T-102 — 시간대 통일 (KST 기준) (v0.12.2) — ✅ 완료 (2026-08-06)
> 시간 처리 종합 검토: ①서버 일집계·통계가 UTC 기준(products.py `stat_date=now.date()`, stats cutoff/min_date) → 확장 그래프(KST)와 하루 어긋남 ②핫딜 cutoff UTC ③디버그 로그 GMT 표시. DB는 UTC 저장 유지 + 일 경계·통계·표시를 KST로 통일.
- [x] **T-102a**: `server/app/datetimeutil.py` 신규 — `KST = timezone(timedelta(hours=9))` + `kst_date()`
- [x] **T-102b**: `products.py` — `_apply_price` stat_date KST(`now.astimezone(KST).date()`) + `get_product_stats` today/cutoff/min_date KST
- [x] **T-102c**: `recommendations.py` — 핫딜 cutoff KST
- [x] **T-102d**: `debug.js` — 로그 표시 `toISOString()`(UTC) → 로컬(KST) 수동 포맷
- [x] **T-102e**: 검증 — pytest 41건(신규 test_tz 5건) + node --check + run-e2e.sh **10/10**
- [x] **T-102f**: CHANGELOG v0.12.2 + 세션 로그

## T-101 — /health 워밍업 404 수정 (v0.12.1) — ✅ 완료 (2026-08-06)
> `sendBatchChunk` 워밍업이 `api("/health")`(SWB_API는 항상 `/api/v1` 접두사)로 `/api/v1/health`를 호출 → 서버엔 루트 `/health`만 존재 → 404 NOT_FOUND WARN 로그 + 콜드스타트 선차단 효과 없음.
- [x] `background.js` 워밍업을 루트 `/health` 직접 `fetch`(AbortController 30s)로 변경 — 200 응답, WARN 제거, 워밍업 정상화. 서버 중복 엔드포인트 추가 없음
- [x] 검증: node --check + 배포 서버 `/health` 200 실측

## T-100 — 가격 추이 그래프 전면 재설계 (v0.12.0) — ✅ 완료 (2026-08-06)
> 플로팅 패널 추이 그래프(`swb-ui.js` `drawChart`) 3대 문제 해결: ①결측 보간으로 2일이 7일로 늘어남(X축 인덱스) ②Y축 여유 없음(min/max가 캔버스 100% 사용 → 최대값 꼭대기 밀착) ③min==max일 때 하단 납작 선 + 마커 겹침.
- [x] **T-100a**: `dailySeries` 재작성 — 결측 보간 제거, 날짜 범위 필터, `{t, price}[]` 반환
- [x] **T-100b**: `drawChart` 전면 재작성 — DPR · 실제 날짜 X축 · Y축 여유(px 고정 + range 8% 버퍼) · 그리드 3줄 · 평균선 · 최저선 · min==max 중앙 점+“변동 없음” · 마커 겹침 방지 · 날짜 라벨
- [x] **T-100c**: `renderTrend` 호출부 대응 — `{series,recordDays}` → `{points,recordDays}`
- [x] **T-100d**: 검증 — node --check + run-e2e.sh **10/10** + 헤드리스 좌표 검증(TC-CHART-001~004)
- [x] **T-100e**: CHANGELOG v0.12.0 기록

## T-99 — UI 디자인 시스템 + UI/UX 개선 (v0.11.0) — ✅ 완료 (2026-08-06)
> 디자인 토큰(CSS 변수) 단일 소스 + 컴포넌트 통일 + FAB 우하단/메뉴 2방향 + 접근성.
> 상세: `docs/plans/PLAN_v0.11.0_design-system.md`
- [x] **T-99a**: `extension/swb-tokens.css` 신규 — 색상/타이포/간격/라운드/그림자 토큰
- [x] **T-99b**: popup.css 토큰 적용 + 잔재(`.alerts/.detail*/.btn-ghost`) 제거 + 헤더 status 분리 + 🛠→SVG
- [x] **T-99c**: swb-ui.js shadow `:host` 토큰 주입 + var() 참조 + 컴포넌트 통일
- [x] **T-99d**: options/onboarding 인라인 CSS → swb-tokens.css link 전환
- [x] **T-99e**: UX — FAB 우하단(bottom:24px) + 메뉴 2방향 재배치 + 팝업 빈 상태 개선
- [x] **T-99f**: 온보딩 문구 동기화 (우하단·메뉴 6개)
- [x] **T-99g**: 접근성 — 이모지→SVG, :focus-visible, aria-label
- [x] **T-99h**: 검증 — node --check + run-e2e.sh 10/10 + CHANGELOG + manifest v0.11.0
- [x] **T-99i**: 네이버+ 스토어 표기/주소 전환 — "네이버 스마트스토어"→"네이버+ 스토어", `smartstore.naver.com`→`shopping.naver.com` (표기·링크·스크립트) + `common.js`/`manifest.json`/`e2e.js`/`capture.js`에 shopping 감지 추가(스마트스토어 하위 호환 유지) + CHANGELOG/PERMISSIONS/DESIGN 반영
- [x] **T-99j**: FAB 배치 후속 수정 — 우하단(24px) 시도의 메뉴 원점 23px 어긋남 + 화면 밖 아이템 버그 해소 위해 **25vh 복원**, 가격 추이를 FAB 바로 왼쪽(같은 높이)에 배치, **사용법(help) 메뉴 제거 + 아이콘 간격 48px 통일**, 온보딩 문구 "화면 1/4 지점"/"메뉴 5가지"로 정정, capture.js에 메뉴 펼침 좌표 덤프 추가
- [x] **T-99k**: 연관 상품 배치 안정성 — `/products/batch` AbortError 누락 해소: ①batch 전 `GET /health` 워밍업 ②`SWB_API`에 `timeoutMs`/`maxAttempts` 옵션 추가(배치 90s·재시도 2회) ③타임아웃 상향 ④실패 배치 오프라인 큐(`pendingRelated`) 보관 → `pollAlerts` 시작 시 `flushPendingRelated` 재전송

## T-98 — 확장 E2E 자동화 (v0.10.6) — ✅ 완료 (2026-08-06)
> 로컬 서버 격리 + 실제 Whale + 실제 확장으로 전체 파이프라인(추출→저장→표시) 자동 검증.
> 상세: `docs/plans/PLAN_v0.10.6_e2e.md`
- [x] **T-98a**: `scripts/e2e/package.json` + playwright-core 설치
- [x] **T-98b**: `e2e.js` — 확장 복사본(서버 URL 치환) + 데모 주입 + 브라우저 E2E + 검증
- [x] **T-98c**: `run-e2e.sh` — 서버 기동/종료 + e2e.js 실행 + 정리 트랩 (exec로 서버 PID 정상 종료)
- [x] **T-98d**: 실검증 (연속 3회 10/10 통과) + 문서 갱신 (README/CHANGELOG)

## T-96 — 웨일 스토어 실등록 (무료, 우선 진행) (v0.10.x) — ✅ 완료 (2026-08-07)
- [x] **T-96a**: 스크린샷 준비 — 자동 캡처 스크립트(`scripts/store-capture/capture.js`) + 데모 데이터 자동 주입/삭제(서버 `DELETE /products/{id}` + 테스트) + 가이드(`docs/store/SCREENSHOT_GUIDE.md`) 완성. **v0.10.7 재구성: 플로팅 화면(1280×800) + 팝업 2장(7일/30일 탭 구분, `captured_at` 확장). v0.12.3 5장 확장: 기본 URL 올리브영 교체 + ④플로팅 메뉴 펼침 ⑤가격 추이 패널 + 임시 과거 포인트(2일+) 추가/실데이터 보존 — 캡처 재실행 완료**
- [x] **T-96b**: zip 패키징 + 리스팅 자료 확정 (STORE_LISTING.md 재사용) — manifest 버전 0.12.2 갱신, `webstore-publish.sh --dry-run` → `dist/shop-wisebar-v0.12.2.zip` 생성(336KB, 미사용 파일 제외 확인), STORE_LISTING.md 웨일 스토어 기준으로 확정. **온보딩 스크린샷 이미지 5장 추가 + capture.js 자동 재생성 + README 갱신 + GitHub Release v0.12.2 생성(zip 첨부)**
- [x] **T-96c**: 웨일 개발자 등록(네이버 로그인, 무료) + 새 확장앱 업로드 + 리뷰 요청 — **완료 (2026-08-06, 사용자 계정으로 업로드 + 심사 요청). 팝업 스크린샷 2장 1280×800 캔버스 중앙 배치로 수정 후 재업로드** (T-96b에서 해결)
- [x] **T-96d**: 심사 통과 확인 + README에 웨일 스토어 링크 반영 — **게재 확인 (2026-08-07, [store.detail](https://store.whale.naver.com/detail/ecaggnboamlnefkmnpddpcoiaidkppog) v0.12.2) + README 배지·섹션 갱신**

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
