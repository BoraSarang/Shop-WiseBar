# 똑바(Shop WiseBar) 변경 이력

## v0.16.16 (2026-08-14) — [server][macos] 매니저 로컬 배치 실행기 + 인사이트 리스트/그리드 + AI 보류 (T-127)
> 사용자 결정: ①로컬 배치는 **수동 실행/종료** (매니저가 Process 직접 제어), ②매니저 앱 로그인 자동 실행은 **설정 토글**(SMAppService), ③AI 도입은 **보류**하고 관리자 기능 우선.
> 상세: `docs/plans/PLAN_v0.16.16_manager.md`
- [ai] **AI 도입 보류 기록** — `docs/AI_MODELS.json` note 갱신 (관리자 기능 우선, AI 재결정은 추후). LLM 미사용 유지.
- [feat-server] **수집 대상 페이지** — `CrawlTarget` 모델 + `GET/POST /admin/crawl/targets` + `DELETE /admin/crawl/targets/{id}` (프리셋 네이버 메인·올리브영 랭킹 + 커스텀 URL, 중복 409/검증 422). 로컬 크롤러 `worker._run_targets`가 enabled target을 순회해 목록 페이지에서 상품 카드(ID·이름·가격) 추출 → 신규 등록/기존 갱신, `crawler_runs`에 `trigger="target"` 기록.
- [feat-server] **인사이트 상품 메타** — `/admin/insight`의 `recent_alerts`/`top_drops`에 상품명·이미지·URL·몰 조인 (N+1 방지 단일 조회).
- [feat-macos] **로컬 배치 섹션** (크롤러 탭) — 시작/중지/1회 실행(Process) + 상태 표시 + 로그 뷰어. **설정 탭 신규** — 로그인 자동 실행(SMAppService) + 서버 오버라이드 UI.
- [feat-macos] **인사이트 상품 카드 개편** — 이미지+이름+가격+몰 카드, **그리드/리스트 토글**, 클릭 시 상품 열기.
- [test] crawl/targets(생성·검증·중복·삭제) + insight 메타 5건 추가 — **pytest 92건 통과** (기존 87 + 신규 5). macOS xcodebuild **BUILD SUCCEEDED**.
- [error] `error_message_ko.json`에 `E-SRV-STOR-1001/1002`, `E-MAC-PROC-1001/1002` 추가.
- 문서: PLAN_v0.16.16 / TODO(T-127) / CHANGELOG / ENDPOINTS.

## v0.16.15 (2026-08-12) — [server][macos][extension] 똑바 매니저 관리 고도화 (T-126)
> 사용자 승인: 매니저 관리 항목 4개 축 전부 선택 — P0 수집 인사이트 + 서비스 헬스 / P1 사용자 활동 / P2 가격 동향 비교.
> 상세: `docs/plans/PLAN_v0.16.15_manager.md`
- [feat-server] **P0 서비스 헬스**: `GET /admin/health` (버전·시작·DB·최근 수집/크롤러) + `GET /admin/crawler/summary` (최근 N시간 성공률·실패·상품없음·평균 소요·스테일 상품 수)
- [feat-server] **P0 수집 상품 인사이트**: `GET /admin/products/top` (많이 수집된 상품 가격포인트+찜 TOP / 최근 수집 / 품절 중 / 품절→복귀) + `GET /admin/products/{id}` 드릴다운 (가격 통계·이력 + 몰 간 비교 alternatives)
- [feat-server] **P1 사용자 활동 추적**: `devices.last_seen_at` + `price_points.device_id` 스키마 마이그레이션 (`_ensure_columns`, SQLite/PG) + `POST /devices/{id}/heartbeat` + `GET /admin/users` (기기별 활성·찜·수집·최근 활동)
- [feat-server] **P2 가격 동향 비교**: `GET /admin/price-compare` — `normalized_name` 동일상품 몰 간 최저가 대비 차이 % (최대 차이순)
- [feat-extension] `background.js` — 폴링(`pollAlerts`) 시작 시 heartbeat 병합 + `/products/batch`에 `device_id` 포함 (사용자 활동 연결)
- [feat-macos] **"헬스" 탭 신규** (HealthView: 서버 상태·크롤러 요약·수집 랭킹) + **"사용자" 탭 신규** (UsersView: 기기 활동 + 몰 간 가격 비교) + APIClient/AppModel 확장
- [test] test_admin 확장 (products/top·detail·health·crawler summary·users·price-compare) — **pytest 87건 통과** (기존 76 + 신규 11). macOS xcodebuild **BUILD SUCCEEDED**. extension `node --check` OK.
- [fix-test] `test_trend_returns_days_series` 날짜 의존 제거 (하드코딩 과거일 → 오늘 KST 캡처) — trend 창(최근 7일)을 벗어난 고정일이 원인.
- 문서: PLAN_v0.16.15 / TODO(T-126) / CHANGELOG / ENDPOINTS / DESIGN.

## v0.16.14 (2026-08-11) — [server] 네이버 브랜드상품 0건 버그 + Browserless 컨텍스트 레이스 수정 (T-125)
> 재개 검증(로컬 `--once`) 중 발견한 2건 수정. 로컬 시스템 Chrome 폴백으로 oliveyoung 2건 + 네이버 brand 상품 3건 수집 성공.
- [fix-server] `crawlers/naver.py` — 후보 쿼리에 `url LIKE '%brand.naver.com%'` 필터 추가. **원인**: mall='naver' 후보 30건을 `last_checked_at` 오름차순으로 가져오는데 null(미확인) smartstore 광고성 상품이 30을 점유 → brand 상품(389건 전체 stale)이 영원히 후보에 못 들어가 naver 배치가 계속 0건이었음.
- [fix-server] `crawlers/_browser.py` — `new_context()`: Browserless CDP에서 상품별 `browser.new_context()`를 만들지 않고 **기본 컨텍스트(`contexts[0]`)를 재사용** + 이전 페이지 close. `close_context()` 헬퍼 신설 — Browserless는 페이지만 정리(컨텍스트 유지), 로컬은 `ctx.close()`. **원인**: CDP 재사용 컨텍스트를 close하면 공유 클라우드가 브라우저 세션을 함께 닫아 다음 상품에서 `TargetClosedError`/`Failed to open a new tab`.
- [주의] Browserless 무료 티어(production-sfo 공유)는 **연속 세션·새 탭 쿼터 제한**이 있어 2번째 배치부터 실패하는 것을 확인 — 상시 운영은 로컬 macOS 크롤러(무료, BROWSERLESS_TOKEN 미설정 → 시스템 Chrome) 또는 Browserless 유료 플랜 필요.
- [검증] `BROWSERLESS_TOKEN` 설정 상태: oliveyoung 2건 성공 후 2차 배치부터 세션 쿼터 실패. 토큰 미설정(폴백): oliveyoung 2건 + 네이버 3건(199000·7900·79900원) 전부 수집 (33.7s).
- [fix-server] `app/config.py` — `APP_VERSION` 0.16.9→**0.16.14** (v0.16.13 배포 시 미갱신으로 /health가 구버전 노출 — 이번 배포에서 정상화).
- 문서: PLAN_v0.16.13_browserless.md 갱신, TODO(T-125), session 로그, CHANGELOG.

## v0.16.13 (2026-08-11) — [server] Browserless 연동 — 크롤러 Chrome을 클라우드로 이전 (T-124)
> 근본 구조 해결: Render 512MB 컨테이너 안에서 Playwright Chrome이 메모리를 압박해 `/health` 지연·재시작 루프를 일으키던 문제를, **브라우저를 Browserless(production-sfo.browserless.io)로 이전**해 컨테이너에서 Chrome을 완전히 제거.
- [방식] Browserless Setup Assistant 분석 기반 — **Path D(기존 Playwright 코드 재포인팅)** 선택, `launch()` → `connect_over_cdp()` 최소 변경. BAP/재작성 없음.
- [fix-server] `crawlers/_browser.py` — `BROWSERLESS_TOKEN` 설정 시 `wss://production-sfo.browserless.io/chromium/stealth?token=...` 로 CDP 연결.
  - **stealth 경로** 사용: Browserless가 자동화 플래그·지문을 CDP 레벨에서 조정 → 올리브영 Cloudflare 챌린지 우회 (운영 실측, 첫 시도 non-stealth는 90자 챌린지 응답).
  - `new_context()` — CDP 브라우저는 `browser.new_context(user_agent, locale)`을 새 타겟으로 지원 → 상품별 컨텍스트 분리. 일부 CDP가 미지원 시 `contexts[0]` 재사용 폴백 + `set_extra_http_headers` UA 주입.
  - token 미설정 시 **기존 로컬 launch 폴백 유지** (회귀 없음).
- [검증] 로컬 `--once`: Browserless stealth로 oliveyoung **2건 수집 성공** (챌린지 우회, 프로세스-미실행). token 미설정 폴백 → 시스템 Chrome 정상. Render 컨테이너 메모리 부담 0.
- [배포] Render web/worker 서비스 `Environment`에 `BROWSERLESS_TOKEN` 추가 필요(대시보드, git 무노출). `.env`(로컬, gitignore)에만 실값 — `.env.example`은 키만.
- [보안] token은 커밋·로그·스크린샷에 노출 금지. MCP 확장 시 `.cursor/mcp.json` 등 gitignore 확인 후 진행.
- 문서: PLAN_v0.16.13_browserless.md, TODO(T-124), session 로그, CHANGELOG.

## v0.16.12 (2026-08-10) — [server] 크롤러 워커 배치 일시 정지 + 재개 방법 2종 준비 (T-123)
> 운영 실측: 배치 실행 중 `/health` 11.4→31.0초 지연 → Render 헬스 체크(5s) 실패 → 재시작 루프. 근본 원인은 단일 512MB 컨테이너에 uvicorn+Playwright(Chrome)를 같이 돌려 Chrome이 메모리를 압박하는 구조였음. **일시 정지** 후 재개 방법 2가지(① Render worker $7/월, ② 로컬 macOS 크롤러 무료)를 준비.
- [상태] 운영 `crawler_config.enabled=false` 적용 완료 (API 재조회 false 확정). 배치 미동작 → Playwright 미기동 → `/health` 0.3~0.8초 안정.
- [준비①] `render.yaml` — web은 `command`로 **uvicorn 단독**(Chrome 격리) + `shop-wisebar-worker` 서비스 정의($7/월, Blueprint Sync로 생성) — **chatRefresh 전까지 미활성**.
- [준비②] `scripts/run-local-crawler.sh` + `scripts/com.shopwisebar.crawler.plist` — 로컬 macOS 무료 크롤러 (launchd 상시 등록, Playwright 로컬 Chrome 사용). `.env`(server/, gitignore)에 DATABASE_URL 실측 입력.
- [검증] `./scripts/run-local-crawler.sh --once` — oliveyoung 2건 수집(19.0s), **B000000258149(바디핌, B+12 필터) 포함 성공**, naver 0건. Render web과 독립임 확인.
- [주의] ①과 ②를 동시에 켜면 배치 2회 중복 — **한 가지만 활성화**. 재개 시 사용자가 `PUT /admin/crawler/config {"enabled":true}` 후 worker 구동 필요.
- 문서: PLAN_v0.16.12_server.md.

## v0.16.11 (2026-08-10) — [extension] 올리브영 B+12자리 goodsNo 누락 수정 (기획세트 등)
> 배포 검증 중 발견: 운영 DB에 `B000000258149`(바디핌 EMS 리프팅컷 97,000원), `B000000231506`(뷰앤디 넥세라 178,000원) 등 **B 접두사 상품**이 extension(실제 상세페이지)으로 정상 등록돼 있는데, v0.16.10 필터가 `^[AB]\d{12}$`가 아닌 `^[A]\d{12}$`로 좁게 만들어 B 상품을 추가 등록/수집에서 누락시켰음.
- [근거] 서버 `crawlers/oliveyoung.py` 첫머리 docstring이 이미 "goodsNo 규약: **A+12자리 또는 B+12자리(13자)**"로 명시 — 확장 필터만 A를 고정해 과잉 차단.
- [fix-extension] `background.js` — 올리브영 productID 검증 가드 2곳 `^A\d{12}$` → **`^[AB]\d{12}$`**. `content.js` — 연관 카드 이미지 파일명 `A(\d{12,})ko\.jpg` → `([AB])(\d{12,})ko\.jpg` (B 접두사도 "접두사+첫 12자리" 규칙 유지).
- [검증] 15자 오염(이미지 파일명 순번 오남용) 차단은 **보존** — `[AB]+12자리=13자`만 통과이므로 15자/14자 ID는 여전히 차단됨.
- [배포] 확장 버전 0.16.10→**0.16.11**, `dist/shop-wisebar-v0.16.11.zip` 재패키징. Chrome 개발자 모드 재로드 필요. 서버 재배포 없음.
- [store] **웨일 스토어 재게재 확인** — [똑바 (Shop WiseBar)](https://store.whale.naver.com/detail/ecaggnboamlnefkmnpddpcoiaidkppog) **v0.16.11 게재 완료** (사용자 계정 업로드).

## v0.16.10 (2026-08-10) — [extension][server][db] 올리브영 상품 ID 15자 오염 치명 버그 수정 + 전수 재수집
> 사용자 보고: "올리브영 상품 ID 길이가 틀린 것 같다" (에러 A00000024806533(15자) vs 정상 상품 A000000247086(13자)). 근본 조사로 **며칠간 크롤러 삽질의 진짜 원인**이 확정됨.
- [원인] `extension/content.js extractRelatedOliveyoung` — 올리브영 연관상품 카드가 `a[href]` 없는 div라 **이미지 파일명** `A00000017264304ko.jpg`에서 정규식 `A(\d+)ko\.jpg`로 **A+14자리(15자)** ID를 추출. 실제 상세페이지 goodsNo는 **A+12자리(13자)** — 이미지 파일명의 마지막 2자리는 이미지 순번(04/19/02)이었음. 확장이 추가한 올리브영 상품 **41개가 전부 15자 잘못된 ID로 저장** → 서버 크롤러가 fetch하면 모두 "상품을 찾을 수 없어요" → 며칠간 "소멸 상품 정리"로 오인한 것.
- [확증] 15자 ID의 **앞 13자리가 진짜 goodsNo** (실측: A00000024806533→A000000248065 ok 22,000원, A00000023333202→A000000233332 ok 93,000원 등). 성공 수집됐던 기존 13자 상품(스킨1004/셀라딕스/포맨트)과 충돌 없음.
- [fix-extension] `content.js` — 정규식 `A(\d{12,})ko\.jpg` 후 `.slice(0,12)`로 **A+12자리만** 사용. `background.js` — 올리브영 productID `^A\d{12}$` **검증 가드** 추가 (상세/카드 배치 양쪽, 비정상 ID 차단 + 로그).
- [fix-server] `oliveyoung.py` 챌린지 대기 6회(30s)→**8회(40s)** (미국 IP 미해결 케이스 감소). `worker.py` — 배치 후 `crawler_runs` 기록을 **새 세션**으로 전환 (배치 5분 유휴 세션을 Render/Neon이 끊어 INSERT 실패하던 "루프 오류" 수정).
- [db] oliveyoung 상품 **44개 전수 삭제 + 처음부터 재수집** (사용자 결정 — 가격 이력 23건 관계 0건/관심 0건, 백업: /tmp/swb_backup). coupang 291/naver 278 보존.
- [배포] 확장 버전 0.14.0→**0.16.10**, `dist/shop-wisebar-v0.16.10.zip` 생성. Chrome 개발자 모드 재로드 필요.
- 문서: CHANGELOG. (pytest 76건 통과 유지)

## v0.16.8 (2026-08-10) — [server][macos] 크롤러 이력 3상태(성공/실패/상품없음) + 실패 사유 (T-121)
> 사용자 요구: 크롤러 응답이 성공/실패만이 아니라 **성공/실패/상품 없음 3상태**여야 하며, 실패면 **실패 사유**를 알고 싶어 함.
- [server] `crawler_runs`에 `gone`(int, 상품없음/소멸 건수) + `error`(varchar, 실패 사유) 컬럼 추가 — `main.py _ensure_columns` 마이그레이션 (SQLite PRAGMA / PG IF NOT EXISTS, 기존 행 하위호환).
- [server] `oliveyoung.fetch_goods`/`naver.fetch` — 실패 시 `None` 대신 `{status:None, error:사유}` 반환 (브라우저 오류/og:title 없음/챌린지 차단/가격 미발견 구분).
- [server] `run_once` 반환 `(attempted, success)` → **4튜플 `(attempted, success, gone, error)`** — 소멸 상품을 `gone`으로 집계해 실패에서 제외, 오류 사유 누적.
- [server] `worker._run_batch` — gone/error 저장 + 배치 예외 시 사유 기록. `/admin/crawler/logs` 응답에 `gone`/`error` 추가, **`failed = attempted - count - gone`**.
- [macos] `CrawlerLog` gone/error 반영 + `CrawlerView` 이력 행 — **3상태 아이콘**(✓ 성공 / 상품없음 ∘ / ✕ 실패) + "상품없음 N" 표기 + 실패 사유 텍스트(호버 툴팁).
- [검증] pytest **76건**(신규 gone/error 테스트 포함). APP_VERSION 0.16.8.
- 문서: docs/TODO T-121 / PLAN_v0.16.8 / ENDPOINTS.

## v0.16.7 (2026-08-10) — [server] 소멸 상품 재시도 방지 (T-120i)
- [원인] v0.16.6 배포 후 운영 진단 확정: Cloudflare 차단은 해결(`브라우저: 시스템 Chrome` + body 89→160자)됐지만 `배치 oliveyoung: 0건/3건 (143.6s)` 지속. 크롤러가 접근하는 상품 3건(A00000022367116 등)을 **로컬 한국 IP·시스템 Chrome로 직접 조회** → 모두 `og:title="올리브영 온라인몰"` + "찾을 수 없음" = **판매종료(sold-out) 상품**. 일시 차단이 아니라 상품 소멸이 정상 원인. 소멸 상품은 last_checked_at이 갱신되지 않아 **1시간마다 무기한 재시도 → 0건 + 143초 낭비** (운영 실측).
- [server] `oliveyoung.py` — `fetch_goods` 반환에 `status` 추가: `"ok"`(수집) / `"gone"`(**소멸 감지**: og:title=="올리브영 온라인몰" 또는 body "찾을 수 없") / `None`(일시 오류). `run_once`는 `gone`이면 **last_checked_at만 갱신**해 다음 배치 재시도 중단 (가격은 이력 유지).
- [server] `naver.py` — 동일: `fetch` status 반환, body "존재하지 않습니다" → `gone`, `run_once` last_checked_at 갱신.
- [server] `APP_VERSION` 0.16.7.
- [검증] pytest **75건 통과**. 로컬 실검증: 소멸 상품 3건 모두 `status=gone` 감지 (판매종료), 판매중 상품(A000000262781 등) `status=ok` 수집 — gone 분기가 실제 DB last_checked_at 갱신.
- 문서: docs/TODO T-120i / ops/README v0.16.7 / CHANGELOG.

## v0.16.6 (2026-08-10) — [server] 올리브영 Cloudflare 챌린지 차단 대응 (T-120g)
- [원인] v0.16.5 배포 후 운영 진단 로그 확정: `og:title 없음 body=89자 (잠시만 기다려 주세요 ... 접속 정보를 확인 중이에요 RAY_ID)` — 올리브영 Cloudflare가 **Render 미국 데이터센터 IP + Playwright 번들 Chromium(headless shell)**을 봇으로 차단. 로컬 macOS에서 번들 대신 **시스템 Chrome(channel="chrome")으로 성공**했던 실측과 일치.
- [server] `Dockerfile` — `python -m playwright install chrome || true` 추가: 실제 Google Chrome을 사전 설치해 `channel="chrome"`로 헤드리스 봇 감지 회피. 설치 실패해도 빌드 유지(번들 Chromium 폴백). `chromium` 설치도 유지.
- [server] `crawlers/_browser.py` — launch 인자에 `--disable-blink-features=AutomationControlled` 추가 (navigator.webdriver 감지 회피).
- [server] `oliveyoung.py` — Cloudflare "잠시만 기다려 주세요" 페이지 감지 시 **5초 간격 최대 3회 재대기** 후 재확인 (JS 챌린지 자동 해결 대기).
- [server] `APP_VERSION` 0.16.6.
- [검증] pytest **75건 통과**. 로컬 실수집(시스템 Chrome, 리소스 차단 하): 올리브영 3건 + 네이버 1건 성공 유지. 실제 Chrome 우회 효과는 Render 배포 후 운영 로그로 확인.
- 문서: docs/TODO T-120g / ops/README v0.16.6 / CHANGELOG.

## v0.16.5 (2026-08-10) — [server] 크롤러 메모리 경량화 + fetch 진단 로그 (T-120f)
- [원인] v0.16.4 배치 실행 후 **OOM 킬** (Render 무료 티어 512MB, 운영 실측 2026-08-10 08:55 KST). 크로미움 렌더러가 배치(10건 순차) 동안 누적 + idle 브라우저 상주 + 컨텍스트 예외 시 `ctx.close()` 누락.
- [server] `crawlers/_browser.py` — `close_browser()` 추가 (배치 완료 후 크로미움/playwright 리소스 해제). `new_context()` 헬퍼 추가 — **이미지/미디어/폰트/광고 요청 차단**으로 메모리·대역폭 절감 (og 메타/body 텍스트 파싱엔 영향 없음). launch에 `--no-sandbox --disable-gpu --disable-dev-shm-usage`.
- [server] `oliveyoung.py`/`naver.py` — 컨텍스트를 `new_context()`로 교체 + `try/finally`로 **`ctx.close()` 누락 방지**. 배치 크기 **10 → 3건** 축소 (512MB 예산). fetch 실패 원인을 판별하는 **진단 로그** 추가 (og:title 없음/가격 미발견 시 body 미리보기 — 상품 소멸 vs 챌린지/블록 구분).
- [server] `worker.py` — `_run_batch` 종료 시 `close_browser()` 호출 (다음 배치 시 재생성).
- [server] `APP_VERSION` 0.16.5.
- [검증] pytest **75건 통과**. 리소스 차단 하 로컬 실수집: 올리브영 현재 판매상품 3건(프로티원 25,900원 등) + 네이버(의성마늘프랑크 52,800원). 소멸 상품은 "상품을 찾을 수 없어요/존재하지 않습니다"로 진단 로그 분별 확인 — **수집 0건의 원인(상품 소멸 vs 차단)을 운영 로그로 확정 가능**.
- 문서: docs/TODO T-120f / CHANGELOG.

## v0.16.4 (2026-08-10) — [server] Render Docker 전환으로 크롤러 브라우저 설치 고정 (T-120)
- [원인] (1) v0.16.3 런타임 자가 설치는 Render 비root에서 `--with-deps` sudo 블로킹으로 수집 불가 (운영 3회 실측). (2) v0.16.4 NixPacks(python) 블루프린트 빌드는 non-root 라 `playwright install --with-deps chromium`의 apt-get이 `su: Authentication failure`로 **빌드 자체 실패** (운영 실측, 2026-08-10).
- [server] `server/Dockerfile` 신규 — python:3.13-slim + 크롤러 OS 의존성 apt-get + `playwright install chromium`을 **root로 사전 설치**. `COPY server/ .` + `uvicorn ... & python -m crawlers.worker` CMD.
- [server] `render.yaml` — runtime **docker**로 전환, `dockerfilePath: ./server/Dockerfile`, `dockerContext: .`. 대시보드 빌드 명령 의존 완전 제거.
- [server] `crawlers/_browser.py` — 시스템 Chrome 실패 시 번들 Chromium 폴백 유지(백업). `--with-deps` 런타임 호출은 stdin 차단+180s timeout으로 중단되지 않게 보완.
- [server] `APP_VERSION` 0.16.4 (health로 배포 확인).
- [검증] pytest 75건 통과. 로컬 렌더 시뮬(시스템 Chrome 부재) 번들 Chromium 수집은 v0.16.3에서 성공 확인. Docker 빌드는 Render에서 검증.
- 문서: docs/ops/README v0.16.4 (Docker 전환 사유 + 블루프린트 적용법) / docs/TODO T-120 / CHANGELOG.

## v0.16.3 (2026-08-10) — [server] 운영 크롤러 브라우저 폴백 (T-120)
- [원인] 운영 로그: oliveyoung 10건/naver 5건 전수 실패 + 0.9초 (2026-08-10 실측). Render 컨테이너에 시스템 Chrome이 없어 `_get_browser()`의 `channel="chrome"` launch가 즉시 실패 → fetch 전부 None. 게다가 `playwright`가 requirements.txt에 없어 운영엔 미설치(import 실패가 fetch 실패로 흡수).
- [server] `crawlers/_browser.py` 신규 — 브라우저 실행 공용: 시스템 Chrome 우선, 없으면 Playwright 번들 Chromium으로 폴백. oliveyoung/naver 중복 `_get_browser()` 제거 후 공용 사용.
- [server] `requirements.txt`에 `playwright>=1.49.0` 추가 (크롤러 의존성 누락 수정).
- [server] Render 빌드 명령에 `python -m playwright install --with-deps chromium` 추가 (`docs/ops/README.md`) — 운영 DB 마이그레이션 불필요(T-119 배포 유지).
- [검증] 시스템 Chrome 미설치(Render) 시뮬레이션 → 번들 Chromium으로 올리브영 수집 성공(이름/이미지/28,900원). pytest **75건 통과**.
- 문서: docs/TODO T-120 / docs/ops/README v0.16.3 / CHANGELOG. 커밋 후 Render 재배포 필요 (빌드 명령 변경).

## v0.16.2 (2026-08-10) — [server][macos] 크롤러 성공/실패 통계 (T-119)
- [server] `crawler_runs.attempted`(시도 건수) 컬럼 신설 — 실패수 = `attempted - count`(성공). `_ensure_columns` 마이그레이션(SQLite ALTER + PG `ADD COLUMN IF NOT EXISTS`), 기존 행은 0 유지.
- [server] `oliveyoung.py`/`naver.py` `run_once()` 반환값 `int`(성공) → `tuple[int, int]` `(attempted, success)`. 시도 = 실제 fetch 호출 수(네이버는 `brand.naver.com` URL 필터 통과 후). fetch/저장 실패는 success 미포함.
- [server] `worker.py` — 배치 로그에 `attempted` 기록 (`배치 oliveyoung: 2건 수집 / 5건 시도`).
- [server] `GET /admin/crawler/logs` 응답에 `attempted`/`failed` 추가 (`failed = attempted - count`, 이전 행은 0으로 계산).
- [macos] 크롤러 실행 이력 행 → **"대상 N건 중 성공 M · 실패 K"** (성공 초록, 실패 > 0 빨강). `CrawlerLog`는 이전 배포 응답(attempted 없음)에도 호환(0 기본값).
- [server] `APP_VERSION` 0.16.2.
- [검증] worker 배치 스텁(oliveyoung 5/2, naver 3/0) → `crawler_runs` attempted 반영 확인. pytest **75건 통과** (신규 1건 + 회귀). macOS xcodebuild **BUILD SUCCEEDED**.
- 문서: `docs/plans/PLAN_v0.16.1_macos-crawler.md` v0.16.2 섹션 / TODO T-119 / ENDPOINTS `/logs` 필드.

## v0.16.1 (2026-08-10) — [macos] 똑바 매니저 크롤러 제어/모니터링 화면 (T-118)
- [macos] 사이드바에 **"크롤러"** 섹션 추가 (`gearshape.2`) — 수집 설정 + 실행 이력.
- [macos] `APIClient` — `CrawlerConfig`/`CrawlerLog` 모델 + `put`/`post` 헬퍼 + 메서드 4종(`crawlerConfig`/`updateCrawlerConfig`/`requestCrawl`/`crawlerLogs`).
- [macos] `AppModel` — `Section.crawler` + 설정/이력 상태 + `refreshCrawler()` + 제어 액션(`setCrawlerInterval`/`toggleCrawlerEnabled`/`requestCrawl`).
- [macos] `CrawlerView` 신규 — **수집 설정**: 주기 세그먼트(1/3/6/12/24시간) + 활성화 토글 + "지금 수집" 버튼(서버 POST, 다음 틱 30초 내 1배치). **실행 이력**: 몰 배지 + 성공/실패 + 건수 + 소요 + 트리거(수동/예약) + KST 시각, 최근 50건.
- [macos] 사이드바 하단 버전 하드코딩 → `Bundle.versionString` 동적 표시. `project.yml` MARKETING_VERSION 0.16.1.
- [검증] xcodebuild **BUILD SUCCEEDED**. 로컬 서버(0.16.0) 연결 실운영 확인 — 크롤러 탭 진입 시 config+logs 로드, 설정 변경/수집 요청 반영. 서버 pytest **74건 통과** (서버 변경 없음).
- 문서: `docs/plans/PLAN_v0.16.1_macos-crawler.md` / TODO T-118 / ENDPOINTS(v0.16.0) 재사용.

## v0.16.0 (2026-08-10) — [server] 네이버 서버 크롤러 추가 + 크롤러 제어 API (T-116, T-117)
- [server] `crawlers/naver.py` 신규: 브랜드스토어(`brand.naver.com`) 상품 자동 수집. `channel="chrome"` 헤드리스 + Chrome UA + `wait_until="networkidle"` + 가격 텍스트 대기 스크롤(최대 5회) + body `N원` 정규식.
- [server] `crawlers/worker.py` — `CRAWLABLE_MALLS=("oliveyoung","naver")` 정의 + `naver.run_once` 병렬 호출. (기존 oliveyoung.py 80행 `CRAWLABLE_MALLS` 임포트 버그 해소: 미정의 상수 참조)
- [server] 각 크롤러 `run_once`를 자사 몰 필터로 격리 — `Product.mall == "oliveyoung"` / `Product.mall == "naver"` (공유 후보 쿼리로 네이버가 올리브영만 선점하던 버그 수정)
- [server] **크롤러 제어/모니터링 (T-117)**: `crawler_runs`(배치 이력) + `crawler_config`(싱글턴 설정) 테이블 신설, startup 시드.
- [server] `crawlers/worker.py` 30초 틱 재작성 — 매 루프에서 DB 설정(주기 1/3/6/12/24시)을 읽어 **실시간 반영**, `run_requested` 즉시 1배치 소비, 몰별 배치 결과를 `crawler_runs`에 기록, `--once` 검증 모드.
- [server] `GET/PUT /admin/crawler/config` — 주기·활성화 조회/변경(허용지 422) · `POST /admin/crawler/run` — 즉시 수집 트리거 · `GET /admin/crawler/logs?limit=` — 배치 이력(몰·성공/실패·건수·소요·트리거·KST).
- [server] `APP_VERSION` 0.16.0.
- [검증] 2차 크롤링 검증(ShopWiseBar-Verify, 2026-08-10): 로컬 시스템 Chrome에서 네이버 캡차 0회, 롯데웰푸드 브랜드스토어 실상품 10건 갱신(가격 1,000~66,000원). 1차 PoC의 "네이버 캡차 불가" 결론을 갱신. 쿠팡은 여전히 Akamai 차단 → 익스텐션 의존 유지.
- [검증] worker `--once` 실동작 확인: `POST /run` → 다음 틱 내 즉시 배치(trigger=manual), 올리브영 실수집 2건(28,900원/27,000원) → `crawler_runs` 로그 기록. API 4종 TestClient 실서버 검증.
- [test] `tests/test_crawler.py` 8건 신설 (config 기본/변경/422/toggle + run 트리거 + logs 빈/기록/limit) — 전체 pytest **74건 통과** (회귀 66 → 74). 에러코드 신규 없음(422는 FastAPI 기본). 검증 리포트: `ShopWiseBar-Verify/results/verify-report.md`, 계획: `docs/plans/PLAN_v0.16.0_naver-crawler.md`.

## v0.15.0 (2026-08-08) — [server][macos] macOS 관리 앱 "똑바 매니저" (T-115)
- [server] `GET /admin/overview` 신설: `products/devices/watches/price_points/daily_stats/alerts/relations/priced/sold_out` 전체 카운트.
- [server] `GET /admin/trend?days=` — KST 일자 기준 수집 트렌드 시리즈 `{date, captures, points, new}` (1~180일 가드).
- [server] `GET /admin/malls` — 몰별(쿠팡/네이버/올리브영) 상품 수·평균가·찜·가격책정 집계.
- [server] `GET /admin/collect` — 소스별 가격이력 건수 + 마지막 수집 시각(KST). `GET /admin/insight` — 알림 분포 + 최근 알림 + 직전 대비 5%+ 하락 TOP20.
- [server] `test_admin.py` 6건 신설 — 전체 pytest **66건 통과**.
- [macos] `macos/` 신규 — SwiftUI 네이티브 관리 앱 "똑바 매니저": xcodegen project.yml, DesignSystem(확장 `swb-tokens.css`과 동일 브랜드/몰 색), @Observable AppModel + APIClient(운영/로컬 서버 토글), Music 앱 스타일 NavigationSplitView 사이드바 + 대시보드/인사이트/통계/수집/공통 핫딜 뷰.
- 문서: `docs/plans/PLAN_v0.15.0_admin-macos.md` / `docs/api/ENDPOINTS.md` /admin 섹션 / TODO T-115 등록.

## v0.14.0 (2026-08-08) — [server][extension] 품절 복귀 알림 (T-110)
- [server] `products.back_on_sale_at` 컬럼 신설: 가격 캡처로 품절이 해제되는 순간 기록 (`_apply_price` + `_ensure_columns` 마이그레이션 SQLite/PG).
- [server] `GET /devices/{did}/alerts` `back_in_stock` 알림 신설: 판매 중 + `back_on_sale_at > since`이면 1회. since=None(최초 폴링)은 과거 이력 노이즈 방지로 미발생. 복귀 후 가격 하락/목표가 검사는 정상 진행.
- [extension] 알림 타입 분기: 시스템 알림 "품절 해제 · 다시 만들 수 있어요" + FAB 알림 히스토리 "재입고" 배지(`t-back` 초록) "재판매 중 · N원"
- [extension] manifest 버전 0.14.0.
- [test] pytest 8건 (devices+alerts: 복귀 1회 / 초기 폴링 미발생 / 복귀 후 하락 감지) — 총 60건 통과. 확장 node --check 통과.
- 에러코드: 신규 없음 (기존 `E-EXT-NET-1001` 재사용).

## v0.13.0 (2026-08-08) — [server][extension] 크로스몰 비교 + 구매 타이밍 인사이트 (T-106~T-109)
- [server] `products.normalized_name` 컬럼 신설: 소문자화 → 특수문자 공백 치환 → 불용어(세트/구성/패키지/정품/선물용 등) 토큰 제거. `name_normalizer.normalize()`, upsert 자동 계산 + startup 백필.
- [server] `GET /products/{pid}` `alternatives` 신설: 정규화명 동일 + 다른 몰 + 가격 ±30%인 동일상품을 가격 낮은순(몰당 최대 3) 매칭. 조회 시 동적 계산(별도 테이블/워커 없음). `diff_percent` = 기준 상품 대비 상대 가격 %.
- [server] `GET /watch?include_alternatives=true` — 찜 목록 각 상품에 동일 비교 포함.
- [server] `GET /products/{pid}/stats` `insight_badges` 신설(T-109): 3포인트 이상일 때 "역대 최저가 달성"/"평균보다 N% 저렴"/"7일 최저가 도달" 계산.
- [extension] 상세 패널 "다른 몰 가격" 섹션(`swb-alt`): 몰 라벨(네이버/쿠팡/올리브영) + 가격 + "N% 더 저렴/비쌈" + 👀 추적자 수 + 클릭 시 해당 몰 상품 열기.
- [extension] 찜 목록 행에 타 몰 최저가 미니 배지(`⤓ {몰} {가격}원`), 팝업 현재 상품에도 비교 표시(altBox).
- [extension] 통계 배너 최우선 표시에 `insight_badges` 반영 (상세 패널 + 팝업).
- [extension] manifest 버전 0.13.0.
- [test] 확장 UI node --check 통과. 서버 pytest: 정규화 6 + 대체상품 6 + insight 1 + 기존 회귀 — 총 57건 통과.
- 에러코드: 신규 없음 (기존 E-EXT-NET-1001 재사용).

## v0.12.3 (2026-08-07) — [extension][server] 공개 핫딜 피드 (T-105)
- [server] `GET /api/v1/deals/public` 신설: 모든 사용자 실측 하락/최저가 상품 익명 집계. 5분 인메모리 캐시(`_DEAL_CACHE`), `watchers`(찜 수) 필드 추가. 기존 `/recommendations`는 개인(내 기기) 전용 유지.
- [server] `watches.py` device 미등록 시 404 유지 (테스트에서 선행 등록).
- [extension] 팝업 "오늘의 핫딜" 탭 → "전체 핫딜": `/deals/public` 조회 + `watchers` "👀 N명이 찜" 배지 (0명 포함). 핫딜 리스트 내부 스크롤(`max-height:320px`)로 팝업 전체 600px 고정 유지.
- [extension] 플로팅(FAB) 뷰어 deals 탭: 라벨 "오늘의 핫딜"→"전체 핫딜", `/recommendations`(개인) → `/deals/public`(공개) 전환 + "👀 N명이 찜" 배지.
- [extension] 플로팅(FAB) 메뉴 재배치: 위쪽 열에 전체 핫딜 → 가격 추이 순으로 세로 배치 (알림은 왼쪽 열로 이동).
- [extension] 콘텐츠 스크립트 로그에서 `— badge top 12px` 디버그 위치 정보 제거.
- [extension] manifest 버전 0.12.3.
- [test] pytest 3종 추가(기기 무관 집계/watchers/캐시) + conftest 캐시 격리 — 총 44건 통과.
- 에러코드: 기존 `E-EXT-NET-1001` 재사용. 신규 없음.

## v0.12.2 (2026-08-07) — [landing] 랜딩 페이지 다크 프리미엄 리뉴얼 (T-104)

- **디자인 전면**: 정적 라이트 톤 → **다크 프리미엄** (배경 오브 글로우, 그라디언트 텍스트·버튼, 카드 호버, 모바일 반응형)
- **역동적 인터랙션** (`app.js` 신규): 네비 스크롤 상태, IntersectionObserver 섹션 페이드업, 배경 오브 마우스 패럴랙스, `prefers-reduced-motion` 존중
- **웨일 스토어를 주 CTA로 승격**: 히어로·네비·푸터 모두 `store.whale.naver.com/detail/ecaggnboamlnefkmnpddpcoiaidkppog` 설치 버튼 (GitHub은 보조)
- **섹션 재구성**: 히어로 비주얼 샷 · 기능 6종(설명 다듬기) · 상세 데모 갤러리(스크린샷) · 실사용 단계(온보딩) · 지원 쇼핑몰 · 설치 CTA
- 이미지 사본 `landing/assets/img/`(`screen-01..05.png`, `step-01..04.jpg`) 추가 — 배포 워크플로우(`landing/**`)로 자동 커버
- 검증: `node --check` + 로컬 서버 데스크톱/모바일 스냅샷 + 콘솔 오류 0 + 가로 오버플로 없음 + reveal 15/15

## v0.12.2 (2026-08-07) — [store+extension] 웨일 스토어 게재 완료 (T-96d)

- **웨일 스토어 심사 통과 → 게재 확인**: [똑바 (Shop WiseBar)](https://store.whale.naver.com/detail/ecaggnboamlnefkmnpddpcoiaidkppog) v0.12.2 (2026-08-07, 최종 업데이트 2026. 8. 7.)
- `extension/content.js:338` — 하드코딩된 배지 버전 로그 `v0.8.6` → `chrome.runtime.getManifest().version` 동적 출력으로 수정 (실제 버전 노출)
- README 배지·웨일 스토어 섹션을 "등록 진행 중" → **"게재 완료"** 로 갱신 + 스토어 링크 반영
- T-96 전체 완료 (T-96a 스크린샷 → T-96b 패키징 → T-96c 업로드/심사 → T-96d 게재 확인)

## v0.12.3 (2026-08-07) — [server] 서버 API 지연 개선 + 성능 진단 (T-103)

- **사용자 실사용 로그 분석**: `/alerts`/`watches` 3~6초, `/products/batch` 최대 59초 지연 리포트
- **성능 진단 (로컬 실측)** — 코드 병목 아님 확인:
  - batch 40개 단일: **0.14s**
  - 동시성 8건(batch 4 + health 4): batch 평균 95ms / 최대 107ms, health ~12ms
  - 동시 batch 쓰기 시 `database is locked` 500 (SQLite 단일 쓰기 한계 — 운영 PG엔 해당 없음)
  - 결론: 프로덕션 지연 주원인은 **Render 무료티어 + Neon 서버리스 콜드스타트/슬립** (5분 폴링이 서버를 깨우며 3~6초)
- **`server/app/database.py`** — SQLite에 WAL 모드 + `busy_timeout=3000` + `synchronous=NORMAL` (`event.connect` PRAGMA, `is_sqlite` 가드로 운영 PG엔 무해) → 로컬 동시성 Lock 대기 완화
- **`.gitignore`** — `server/*.db-shm`/`server/*.db-wal` 추가 (WAL 부산물 추적 방지)

## v0.12.2 (2026-08-06) — [store] 웨일 스토어 심사 요청 완료 (T-96c)

- 사용자 네이버 계정으로 웨일 스토어에 `dist/shop-wisebar-v0.12.2.zip` 업로드 + **심사 요청 완료**
- 심사 대기 중 — 승인 시 T-96d(README 링크 반영) 진행

## v0.12.2 (2026-08-06) — [store+extension] 웨일 스토어 패키징 + 리스팅 확정 (T-96b)

- `extension/manifest.json` version **0.11.0 → 0.12.2** (확장에 반영된 v0.12.x 변경 포함)
- `scripts/webstore-publish.sh --dry-run` 실행 → `dist/shop-wisebar-v0.12.2.zip` 생성 (336KB)
  - JS 문법 검증 + manifest 필수 필드/CSP/권한 검증 통과, node_modules/시크릿/DB 제외 확인
  - 미사용 파일 정리: `icons_backup_20260803/`·`make_icons.py` 삭제 (manifest 미참조)
- `docs/store/STORE_LISTING.md` — Chrome Web Store → **웨일 스토어 기준**으로 확정 (등록 URL, 버전 0.12.2, 등록 절차, MV3 호환 명시)
- **온보딩 페이지 개선**: 스토어 스크린샷 5장(축소본 `extension/onboarding/step-01~05.jpg`)을 단계별로 배치, 최신 UI 반영(설정=확장 설정 페이지, FAB 오른쪽 하단 25%, 네이버 쇼핑 검색 태그). `capture.js`에 온보딩 이미지 자동 재생성 단계 추가
- **README 갱신**: 웨일 스토어 등록 진행 배지·설치 방법·최신 기능·패키징 명령 반영
- **GitHub Release v0.12.2 생성** (tag push → Release Extension 워크플로우, zip 첨부)
- T-96c(업로드)에서 사용자 네이버 계정으로 진행 예정

## v0.12.3 (2026-08-06) — [store+script] 웨일 심사용 스크린샷 5장 확장 (T-96a)

- `capture.js` 기본 상품 URL을 올리브영 `A000000224494`로 교체 — 기존 `gamewoori/.../13360049393`은 존재하지 않는 상품(`not-found` 리다이렉트)이라 콘텐츠 스크립트 미주입 문제
- 스크린샷 **3장 → 5장** 확장: ④ 플로팅 메뉴 펼침(1280×800) ⑤ 가격 추이 패널(1280×800) 추가
- 기존 상품이면 **임시 과거 가격 포인트(2일 이상)만 추가**해 가격 추이 그래프 확보 → 캡처 후 **추가분만 삭제** (실데이터 보존)
  - 주의: 기존 실데이터와 같은 가격은 dedup으로 INSERT되지 않는데도 정리 대상에 기록되어 실데이터를 삭제하는 버그 발생 → 수정 (daysAgo 0 항목 제거) 후 복구 완료
- 검증: 5장 캡처 + 임시 포인트 정리 후 실데이터(25,400원) 1건 보존 확인

## v0.12.2 (2026-08-06) — [server+extension] 시간대 통일 (KST 기준, T-102)

### 배경 — 시간 처리 종합 검토
- 서버는 UTC aware로 DB 저장(기존 유지)하지만 **일(daily) 집계·통계·날짜 표시가 UTC 기준** → 확장 그래프(로컬 KST)와 하루 어긋남
- 한국 00~08:59 수집분이 서버에서 "전날" 통계로 집계되는 문제 · 팝업 "역대 최저 (날짜)" 하루 밀림 가능 · 디버그 로그가 GMT(UTC)로 표시되는 문제

### 서버 (T-102a~c, 배포 필요)
- `server/app/datetimeutil.py` **신규** — `KST = timezone(timedelta(hours=9))` + `kst_date(now)` (naive는 UTC 규약으로 간주)
- `products.py` `_apply_price` — `PriceDailyStat.stat_date`를 `now.astimezone(KST).date()`로 (KST 일자 집계)
- `products.py` `get_product_stats` — `today`(기간 cutoff) KST 날짜 · variant 조회 cutoff KST 자정 · `min_date` KST 날짜 반환
- `recommendations.py` — 핫딜 "최근 N일" cutoff KST 시각 기준 (SQLite naive 처리 유지)

### 확장 (T-102d, 즉효)
- `debug.js` 로그 시간 표시 — `toISOString()`(UTC) → **현지 시각(KST) 수동 포맷** `YYYY-MM-DD HH:mm:ss.SSS` (형식·파서 호환 유지)

### 검증 (T-102e)
- `tests/test_tz.py` 신규 5건(KST 날짜 경계·stat_date·min_date) + 전체 pytest **41건 통과**
- `node --check debug.js` + `run-e2e.sh` **10/10 통과**
- 기존 UTC 저장 데이터는 마이그레이션 없이 유지 (신규 수집부터 KST — 기간 경계 인접 데이터만 일시 혼재, 영향 미미)

### 관련 문서
- `docs/plans/PLAN_v0.12.2_tz.md` + `docs/TODO.md` T-102

## v0.12.1 (2026-08-06) — [extension] /health 워밍업 404 수정 (T-101)

- `background.js` `sendBatchChunk` 워밍업이 `api("/health")` → `SWB_API`가 항상 `/api/v1` 접두사를 붙여 **`/api/v1/health` 404(NOT_FOUND)** WARN 로그가 발생 + 콜드스타트 선차단 효과 없음
- **루트 `/health` 직접 `fetch`**(AbortController 30s)로 변경 — 200 응답으로 워밍업 정상화, WARN 로그 제거. 서버 변경 불필요(중복 엔드포인트 없음)
- 검증: `node --check` + 배포 서버 `GET /health` 200 실측 확인

## v0.12.0 (2026-08-06) — [extension] 가격 추이 그래프 전면 재설계 (T-100)

### 그래프 데이터 준비 (T-100a)
- `swb-ui.js` `dailySeries` 재작성 — **결측일 보간(직전 가격 유지) 제거**. 실제 기록일만 `{t(ms), price}[]`로 반환(오늘은 페이지 현재 가격 병합, 7/30일 범위 필터). → 기록 2일이면 2포인트로 정직하게 렌더링
- `renderTrend` 호출부를 `{points, recordDays}` 구조로 대응 (delta는 첫 기록일 가격, st-min/max는 기록일 min/max, st-count는 기록일 수)

### 캔버스 렌더링 전면 재작성 (T-100b)
- **실제 날짜 X축** — 기록일 min~max 시간 범위를 가로에 매핑, 하단 첫/마지막 기록일 `M/D` 날짜 라벨. 기록 1일이면 중앙 단일 점
- **Y축 여유(버퍼)** — 데이터 range의 상하 10% + 상하 pad(상 18/하 20) → 최대값이 꼭대기에 안 붙고 세로 ~90%만 사용
- **min==max 처리** — 동일가격(변동 없는) 상품은 하단 납작 선 대신 **캔버스 중앙 단일 점 + "변동 없음"** 표시. 기존 "하단의 점"(최저/최고 마커 겹침) 해소
- **그리드** — min/mid/max 수평 점선 3줄 + **평균선**(회색 점선) + **최저선**(파란 점선 + "최저 N원" 라벨) 유지
- **마커 겹침 방지** — 최저/최고 좌표가 비슷하면 회색 1점으로 대체
- **DPR 반영** — `devicePixelRatio` 스케일로 고해상도 선명도 개선 (CSS 292×140 유지)
- 하락 구간 파란 굵은 선 / 상승·평탄 회색 얇은 선 동작 불변

### 검증 (T-100d)
- 실데이터 3종 시각 확인: 9648038896(2일 9,800→20,530 변동) · 9590025132(동일가 3,000 — min==max) · 8630323981(같은 날 변동 3건)
- `run-e2e.sh` 전체 통과

### 관련 문서
- `docs/plans/PLAN_v0.12.0_extension.md` + `docs/TODO.md` T-100 등록

## v0.11.0 (2026-08-06) — [extension] UI 디자인 시스템 + UI/UX 개선 (T-99)

### 디자인 토큰 (T-99a)
- **`extension/swb-tokens.css` 신규** — 색상/타이포(10~20px 7단계)/간격(4px 그리드)/라운드(sm6·md8·lg12·pill)/그림자 4종 CSS 변수 단일 소스
  - 팝업·옵션·온보딩은 `<link>`로, swb-ui(shadow DOM)는 `:host`에 동일 토큰 주입 후 `var()` 참조
- 보조색 파편화(`#f2f4ff`/`#eef1ff`/`#f4f7ff`/`#e2e7ff`/`#e8eeff`)와 텍스트 7계층(`#333`~`#aaa`)을 토큰 4계층으로 통일

### 팝업 (T-99b)
- `popup.css` 전체 토큰 기반 리팩터 + 사용처 없는 잔재 제거(`.alerts`·`.alert-list`·`.detail*`·`.btn-ghost`·`.watch-name`)
- 헤더의 status를 본문 최상단 `.status-bar`로 분리(빈 상태 자동 숨김, `aria-live`) — 헤더는 로고+설명만
- 디버그 버튼 이모지(🛠)→SVG, 빈 상태 문구 이모지(🛍️) 제거

### 플로팅 FAB (T-99c, T-99e)
- `swb-ui.js` shadow CSS 전면 토큰 기반 리팩터 + 팝업과 컴포넌트 통일(기간 탭·목표가 행·스피너·배지·썸네일)
- **FAB 25vh 유지 + 메뉴 원점 보정** — T-99e에서 우하단(`bottom:24px`) 시도 후 후속 수정으로 **25vh 복원**(메뉴 원점=FAB 중심 일치, 아이콘이 FAB를 덮던 23px 오프셋 해소)
- **메뉴 3방향 재배치** — 위(핫딜/알림) · 왼쪽(가격 추이 바로 옆, 찜 목록) · 아래(설정/사용법/디버그, 라벨 dir=above)
- 패널 위치 FAB 상단 정렬로 변경, 핫딜 배지 이모지(🎉/🔥) 제거

### 옵션·온보딩 (T-99d, T-99f)
- 인라인 CSS → `swb-tokens.css` 공유(토글 스위치·err-box 등 토큰 참조)
- 온보딩 문구 동기화: 펼침 메뉴 4가지→**6가지**(핫딜/알림/추이/찜목록/설정/사용법), 툴바 설명 정정

### 접근성 (T-99g)
- 이모지 아이콘→SVG, `:focus-visible` 포커스 링(팝업/플로팅/옵션/온보딩), 상태 영역 `aria-live`

### 검증 (T-99h)
- `node --check` 전체 통과 + `run-e2e.sh` **10/10 통과** (팝업 렌더·핫딜 5개·데모 정리)
- manifest v0.11.0 상향, `docs/plans/PLAN_v0.11.0_design-system.md` + `docs/DESIGN.md` 3.7 UI 디자인 시스템 섹션

### 네이버+ 스토어 표기/주소 전환 (T-99i)
- **표기 일괄 전환**: "네이버 스마트스토어" → **"네이버+ 스토어"** (popup/onboarding/landing/PRD/DESIGN/PERMISSIONS/STORE_LISTING/README 등)
- **주소 전환**: `smartstore.naver.com` → `shopping.naver.com` (문서·UI 링크·스크립트 기본 URL)
- **기능 하위 호환**: `common.js` MallParser/parseProductID에 `shopping.naver.com`을 `store:{store}:{id}` 규약으로 추가 감지, 기존 `smartstore.naver.com` 호환 유지
- `manifest.json` host_permissions/content_scripts에 `*://shopping.naver.com/*` 추가 (smartstore·brand·search.shopping 유지)
- `e2e.js`/`capture.js` 감지 로직도 smartstore+shopping 병행
- 검증: `node --check` 전체 통과 + manifest JSON 파싱 OK

### FAB 배치 후속 수정 (T-99j)
- **FAB 25vh 복원**: `bottom:24px` 시도로 메뉴 원점이 FAB 중심과 23px 어긋나 아이콘이 FAB를 덮고, `y>0` 아이템(찜 목록·사용법)이 화면 밖으로 밀려나는 버그 발견
- `.swb-fab` `bottom: calc(25vh - 23px)` + `.swb-menu` `bottom: 25vh` → 원점 정확 일치, 아래 방향 아이템 화면 안 복귀
- **가격 추이 FAB 바로 왼쪽 배치**(x=-60, y=0, 같은 높이) — 메뉴 열면 버튼 왼쪽에 추이가 가장 가깝게 노출
- **사용법(help) 메뉴 제거** — 온보딩에서만 안내(옵션 "사용법 보기"로 접근). `onMenuItem` help 분기 정리
- **아이콘 간격 48px로 통일**: 위 열(핫딜/알림 -60/-108) = 왼쪽 열(추이/찜 0/48) = 아래 열(설정/디버그 60/108) 동일 여백
- 메뉴 배치: 위(핫딜/알림) · 왼쪽(추이/찜 목록) · 아래(설정/디버그, 라벨 dir=above) — 5개
- 온보딩 문구 정정: "우하단" → "화면 오른쪽 1/4 지점" + 추이 왼쪽 설명 + "메뉴 5가지"
- `capture.js`에 메뉴 펼침 시 아이콘 화면 좌표 덤프(텍스트) 추가 — 화면 밖/겹침 검증
- 검증: `node --check` + capture 메뉴 좌표 덤프(모든 아이콘 화면 내부·좌표 정확) + `run-e2e.sh` 회귀

### 연관 상품 배치 안정성 개선 (T-99k)
- **문제**: `POST /products/batch`가 서버 지연(Render 무료티어 3~9s 응답) + 45s 타임아웃/MV3 SW 유휴 종료로 abort → POST 재시도 0회라 연관(카드) 상품 3회 누락 (`AbortError: signal is aborted without reason`)
- **A. 워밍업**: `sendBatchChunk`가 batch POST 전 `GET /health`(30s)로 콜드스타트/sleep 선차단
- **B. 재시도**: `SWB_API`에 `timeoutMs`/`maxAttempts` 옵션 추가 — 멱등 upsert인 `/products/batch`는 90s·재시도 2회, `/products/relations` 60s·재시도 2회 (prices는 중복 위험으로 기본 유지)
- **C. 타임아웃 상향**: 배치 전용 90s (Render 콜드스타트 최대 ~60s + 재시도 대기 여유)
- **D. 오프라인 큐**: 실패 배치를 `chrome.storage.local` `pendingRelated`에 보관(최대 10건, 초과 시 오래된 것 삭제) → SW가 깨어날 때마다(`pollAlerts` 시작) `flushPendingRelated`로 재전송, 성공 시 큐에서 제거
- 검증: `node --check` + `run-e2e.sh` 10/10 회귀

## v0.10.7 (2026-08-06) — [store+server] 웨일 심사용 스크린샷 재구성 (T-96a, 플로팅 화면 추가)

### 도구 (T-96a)
- **스크린샷 3장 구성**: `scripts/store-capture/capture.js` 개편
  - `shop-wisebar-01.png` — **1280×800 상품 페이지 전체 + 플로팅 버튼** (실사용 화면, 심사용 메인)
  - `shop-wisebar-02.png` — 팝업 320×600 현재 상품 탭 (핫딜 7일 기본 노출)
  - `shop-wisebar-03.png` — 팝업 320×600 **핫딜 30일 탭** (기존엔 7일이 기본 active라 02와 동일했음)
  - 실행 로그에 `✓ 플로팅 버튼 표시 확인` + `▸ 팝업 상태(30일):` 덤프 추가 (텍스트 전용 모델 검증 대응)
- **문제 수정**: 기존 `01/02.png`는 둘 다 팝업 화면으로 완전 동일(픽셀 diff 0) + 플로팅 화면 부재 →
  상품 페이지 전체 캡처 + 기간 탭 구분으로 재구성

### 서버 (T-96a)
- **`PriceUploadIn.captured_at` 추가** — 데모 시딩이 과거 시점 가격을 등록 가능
  (`server/app/schemas.py`, `server/app/routers/products.py`)
- 데모 하락을 `captured_at`으로 시점 지정 — 7일 하락 3개(priceDays=5/dropDays=3) + 30일 하락 2개(priceDays=20/dropDays=15)
  → `/recommendations`가 days 필터로 **7일 탭 3개 / 30일 탭 5개**를 구분 노출 (로컬 검증 완료)
- pytest `test_products.py` 2건 추가 (captured_at 과거/현재) → **36건 전체 통과**

## v0.10.6 (2026-08-06) — [extension+server] 확장 E2E 자동화 (T-98)

### 도구 (T-98)
- **E2E 자동화**: `scripts/e2e/run-e2e.sh` + `e2e.js` — 로컬 서버(임시 SQLite, 격리) + 실제 Whale + 실제 확장으로 전체 파이프라인 자동 검증
  1. 서버 기동(`/health` 대기) → 2. 데모 데이터 주입(핫딜 5개) → 3. 확장 복사본 생성(`common.js` 서버 주소 → 로컬 포트 치환, 원본 불변) → 4. Whale + 확장 로드(기존 `.whale-profile` 복사 재사용) → 5. 실제 상품 페이지 방문 → 콘텐츠 스크립트 가격 추출 → 서버 업로드 → 6. 팝업 렌더링 검증(상품명/가격/통계/핫딜 5개) → 7. 데모 자동 정리(404 확인)
- 검증 TC 6종 (TC-E2E-001~006) — **연속 3회 10/10 통과**, 서버·임시 DB·프로필·복사본 전부 자동 정리
- 실행: `./scripts/e2e/run-e2e.sh` / 가이드: `scripts/e2e/README.md` / 계획: `docs/plans/PLAN_v0.10.6_e2e.md`
- **실측 이슈**: 네이버 스마트스토어는 자동화 브라우저 접속 시 HTTP 429(봇 차단) — E2E 기본 상품은 봇 차단 없는 **올리브영** 사용. `run-e2e.sh [상품URL]`로 상품 지정 가능

### 부수 개선
- `scripts/e2e/run-e2e.sh`: `(cd ... && exec uvicorn) &`로 서브셸을 uvicorn으로 대체 → `$!`가 실제 서버 PID → 종료 보장 (기존 서브셸 방식은 uvicorn 잔존 이슈)

## v0.10.4-post (2026-08-06) — [server+store] 웨일 심사용 스크린샷 자동 캡처 (T-96a)

### 도구 (T-96a)
- **자동 캡처 스크립트**: `scripts/store-capture/capture.js` — 웨일 실행 → 확장 unpacked 로드 → 서버에 데모 데이터 주입(핫딜 5개 + 현재 상품 가격 이력) → 팝업 캡처 2장(`docs/screenshots/store/shop-wisebar-{01,02}.png`) → **데모 데이터 자동 정리**. `playwright-core` 사용
- **수동 정리**: `scripts/store-capture/cleanup.js` — capture 비정상 종료 시 잔여 demo 상품 삭제
- **가이드**: `docs/store/SCREENSHOT_GUIDE.md` — 자동/수동 캡처 방법 + 스토어 제출 체크리스트

### 서버 (T-96a)
- **`DELETE /products/{id}`** 추가 — 데모 데이터 정리용. FK 참조 테이블(watches/alerts/price_daily_stats/product_relations/price_points)을 정리 후 상품 삭제, 없으면 204(idempotent)
- pytest `test_demo_cleanup.py` 2건 추가 → **34건 전체 통과**

### 검증
- 실서버 배포 완료 (`DELETE /products/{id}` 204 확인) — 이전 캡처 실행에서 정리 실패했던 demo 상품 5개 수동 정리 후, 캡처 스크립트 전체 재실행: 팝업 상태 정상(현재 상품 8,900원 + 평균/최저 + 핫딜 5개) + 데모 자동 정리 완료 + 잔여 404 확인

## v0.10.4-post (2026-08-06) — [server] 코드 리뷰 후속: 버그 수정 + 리팩토링 (T-95)

### 버그 수정 (T-95a)
- **배치 가격 dedup 시 500**: `_apply_price`가 `db.get(Product)`로 재조회하는데 SessionLocal이 `autoflush=False`라 batch에서 `_upsert`가 방금 추가한(pending) 상품을 못 찾아 `None` → `AttributeError` 500. 가격이 직전과 같은 재캡처에서 항상 발생. → 전달받은 Product 객체를 직접 사용하도록 수정
- **실제 충돌 테스트 추가**: 기존 `test_batch_partial_failure_continues`는 주석과 달리 실제 UNIQUE 충돌을 만들지 않았음 → `tests/test_batch_conflict.py`로 실제 충돌 경로(savepoint 스킵 + 세션 오염 없음) 검증

### 리팩토링 (T-95b)
- `upload_price`(개별)의 dedup/일별 통계 로직이 `_apply_price`(배치)와 중복 → 코어로 통합. `captured_at` 파라미터 추가로 같은 초 충돌 +1s 재시도(v0.10.1) 유지

### 성능/정리 (T-95c)
- `GET /devices/{id}/alerts`: `w.product` lazy load N+1(12쿼리) → `selectinload`로 8쿼리 (watch 수만큼 추가 쿼리 제거)
- `/health` version이 하드코딩 0.2.0으로 고정 → `config.APP_VERSION`(0.10.4)으로 통일

### 검증
- pytest **32건 통과** (신규 실제 충돌 테스트 2건 포함)

## v0.10.4 (2026-08-06) — [server] 연관 상품 일괄 업로드 + DB 연결 풀

### 성능 (T-93)
- **일괄 업로드 API (T-93a)**: `POST /products/batch` — 최대 50개(확장은 40개 청크) 상품의 upsert+가격 저장을 1요청으로. 단일 트랜잭션 + 항목별 savepoint(`begin_nested`)로 부분 실패 시 해당 항목만 스킵. 같은 요청 내 중복 product_id는 첫 건만 처리. 응답 `{upserted, price_count, items}`
- **확장 배치 전환 (T-93b)**: `uploadRelatedItems`를 기존 개별 `/products` + `/prices` (상품당 2요청, 40개 카드 = 80요청) → `/products/batch` 청크 전환. 미사용 `mapLimit`(동시성 5 병렬) 제거
- **코어 로직 추출**: upsert/가격 저장 로직을 `_upsert`/`_apply_price` 헬퍼로 추출 — 개별·배치 동일 동작 (name 정책, 절단, 가격 dedup, 일별 통계, 품절 자동 해제)

### 성능 (T-94)
- **DB 연결 풀 (T-94a)**: PostgreSQL(Neon) `QueuePool` — `pool_size=5, max_overflow=10, pool_pre_ping=True, pool_recycle=600`. 요청마다 TCP+TLS+인증을 새로 맺는 오버헤드 제거 ([PERF] 1~3s 지연 원인). SQLite는 기존 유지

### 검증
- pytest batch 6건 추가 (upsert/price, 가격 없는 upsert, 중복 dedup, 같은 가격 dedup, 부분 실패 격리, 빈 요청) + 기존 24건 → **30건 통과**
- `node --check background.js` 통과

## v0.10.3 (2026-08-06) — [server] 서버 운영 개선: 로깅 + /health 강화 + 추천 쿼리 인덱스

### 운영 개선 (T-91)
- **구조적 로깅 (T-91a)**: `app/logging_setup.py` — 요청 미들웨어(`req method=GET path=/health status=200 elapsed_ms=10.7`) + 전역 예외 핸들러(500 → `E-SRV-GEN-1001`, Python 스택 로그). Render Logs에서 확인
- **/health 강화 (T-91b)**: DB `SELECT 1`(ok/degraded) + `started_at` + `version` + 적용된 인덱스 목록 노출 — 운영 모니터링용
- **운영 문서 (T-91c)**: `docs/ops/README.md` — Render 배포·로그 보기·상태 확인·장애 대응 체크리스트
- `error_message_ko.json`에 `E-SRV-GEN-1001` 추가

### 성능 (T-92)
- **추천 쿼리 인덱스 (T-92b)**: `EXPLAIN QUERY PLAN`으로 추천 하락 쿼리가 `price_points` 전체 스캔(SCAN) 확인 → `ix_price_points_captured`(captured_at) 인덱스 추가로 SEARCH 전환. alerts/daily_stats/relations는 기존 인덱스 사용 확인
- **테스트 강화**: test_health에 DB/인덱스 검증 + 요청 로그 캡처 테스트 추가 (23→24건)


- **권한 최소화 (T-90a)**: 광범위한 `tabs` 권한 제거 → `activeTab`(팝업/옵션 열기 시 활성 탭 URL 접근)로 축소.
  백그라운드 탭 URL 감지는 쇼핑몰 `host_permissions`로 커버, `tab.url` 없으면 `captureProductInner`가 안전 return — 기능 영향 없음
- **privacy_policy (T-90c)**: `landing/privacy.html` 개인정보 처리방침 작성 + 메인 푸터 링크. 스토어 대시보드 입력용 URL 준비
- **스토어 리스팅 (T-90d)**: `docs/store/STORE_LISTING.md` — 설명(short/long)·카테고리·권한 심사 설명·스크린샷 가이드
- **배포 스크립트 (T-90e)**: `scripts/webstore-publish.sh` — JS/manifest 검증 + zip 패키징(`dist/`) + `--dry-run` 지원 (통과). `dist/` gitignore
- **문서 (T-90b/f)**: `docs/chrome/PERMISSIONS.md` v0.10.2 갱신 + 심사 체크리스트 완료
- manifest v0.10.2

## v0.10.1 (2026-08-05) — [server] 서버 테스트 자동화 + 가격 유실 버그 수정 + DB 인덱스

### 테스트 자동화 (T-89)
- `server/tests/` pytest 스위트 구축 (23건, 0.3초): `conftest.py`가 임시 SQLite + `get_db` override + 테스트 간 테이블 초기화
- 대상: devices/watches, products(upsert·가격 dedup·stats·sold-out·prices 삭제), relations, recommendations, health
- CI: `.github/workflows/validate-extension.yml`에 `server-test` job 추가 (Python 3.12 + pytest, `server/**` 변경 시)

### 버그 수정 — 같은 초 다른 가격 유실 (테스트가 발견)
- `POST /prices`가 같은 초(second)에 도달한 서로 다른 가격을 UNIQUE(product_id, captured_at) 충돌로
  "동시 캡처(같은 가격 중복)"로 오판해 유실시킴 → IntegrityError 시 1초 뒤로 밀어 재저장
- (E2E로는 재현이 어렵고 테스트로만 잡히던 데이터 손실 — 테스트 스위트 도입 효과)

### DB 인덱스 점검 (T-89d)
- `price_daily_stats (product_id, stat_date)` 복합 인덱스 추가 — stats/추이/추천 핵심 조회 키
- `product_relations (source_product_id, target_product_id)` 복합 인덱스 추가 — 연관 양방향 조회

## v0.10.0 (2026-08-05) — [extension+server] 가격 통계·시계열 요약 (7일/30일/역대 최저가)

### 서버 — `GET /products/{id}/stats`
- **신규 라우터**: `price_daily_stats` 기반 7일/30일/역대 `{min, min_date, avg}` 반환 (schema `PriceStatsOut` 추가)
- **variant 처리**: 쿠팡 수량 옵션 지정 시 `price_points`에서 해당 variant만 집계 (daily_stats에는 variant가 없으므로). variant 없음 → `price_daily_stats.low_price` 기준 (방문 dedup 정책과 일관)
- 데이터 없음 → null 응답, 404 그대로 (없는 상품 보호)

### 확장 — 요약 배너
- **팝업** (`popup.js/html/css`): 현재 상품에 `trendStats` 배너 — "7일 최저 / 30일 평균 / 역대 최저(날짜)". 상품 조회와 병렬 fetch
- **플로팅 추이 패널** (`swb-ui.js`): `swb-trend-stats` 배너 — 기존 최저/최고/기록 통계 아래. product/prices/stats 3건 병렬 조회 (trendStatsCache)
- E2E 검증: 로컬 서버 주입 데이터로 "7일 최저 54,500원 · 30일 평균 57,500원 · 역대 최저 54,500원 (26/08/05)" 정상 렌더 (차트 + 현재가 병행). 테스트 후 데이터/확장 서버 주소 원복

## v0.9.9 (2026-08-05) — [repo] README 재작성 + GitHub Pages 랜딩 페이지 + GitHub Actions CI/CD

### README.md 재작성
- 2줄 → 제품 소개·설치 방법·기능·아키텍처·개발/커밋 규약 포함으로 확장
- 지원 쇼핑몰 표(productID 규약), 설치(개발자 모드), 다이어그램(익스텐션↔서버), 문의 정보

### GitHub Pages 랜딩 페이지 (`landing/`)
- `landing/index.html` + `landing/assets/style.css` — 히어로/기능 6종/지원 몰/CTA/푸터
- 아이콘은 로컬 사본(`landing/icons/`, gitignore) 대신 Actions 배포 시 `extension/icons`를 `_site/icons`로 복사
- 검증: 로컬 http.server 렌더링(제목/카드6/배지5) + 배포 후 HTTP 200 + icon48 HTTP 200

### GitHub Actions (2개)
- **`deploy-pages.yml`** — main push(`landing/**`, `extension/icons/**`) 시 Pages 배포 (configure-pages/upload-pages-artifact/deploy-pages). Pages 소스를 `build_type: workflow`로 전환 필요(configure-pages 실패 원인 해결)
- **`validate-extension.yml`** — PR/push 시 `extension/*.js`·`extension/popup/*.js` `node --check` + manifest.json MV3/version/action 검증 + error_message_ko.json 검증
- 배포 URL: https://borasarang.github.io/Shop-WiseBar/ (HTTP 200 확인)

## v0.9.8 (2026-08-05) — [extension] 옵션 페이지 서버 장애 안내 + GitHub 릴리즈 링크 추가 + [확인] Edge 로드

### 옵션 페이지 — 서버 접속 실패 시 안내 문구 + GitHub 링크
- **배경**: 사용자가 서버 URL을 변경할 수 없도록 설계(서버 주소는 `common.js`의 `SWB_CONFIG` 단일 관리). 업데이트 시 자동으로 서버 주소가 바뀌므로 사용자에게 주소 변경을 요청하는 것은 타당하지 않음
- **추가**: 서버 `/health` 확인 실패 시 "서버에 접속할 수 없습니다. 문제가 있는지 확인해 보세요." 안내 박스 + **새 버전 확인 (GitHub 릴리즈)** / **GitHub 저장소** 링크 (options.html: err-box, options.js: loadServerStatus 실패 시 errBox 표시)
- 검증: 정상 상태 → errBox 숨김(none) + "연결됨". `/health` 차단 → errBox 표시(block) + "연결 실패 (E-EXT-NET-1001)". 옵션 페이지 UI는 서버 주소 표시 전용(수정 불가) 유지

### 확인 — Microsoft Edge 확장 로드 확인
- Edge(151.0.4129.59) Profile 1의 `Secure Preferences`에서 확장 ID `dmdgnfaihmeagfopdabippjnbgngafhj`가 `/Users/lee/Documents/Apps/Shop WiseBar/extension` 경로로 unpacked(개발자 모드) 로드 확인 — 똑바 확장 정상 로드

### 확인 — Google Chrome 실기기 검증 (T-60 마감)
- 사용자 실기기 확인 (2026-08-05): Chrome 개발자 모드 확장 로드 + 상품 페이지 방문 + 서버 DB 저장 정상 동작 확인. 이로써 Whale/Edge/Chrome 3대 크로미움 브라우저 로드·동작 모두 검증 완료

## v0.9.7 (2026-08-05) — [extension] 플로팅 찜 목록 삭제 버그 수정 + 가격 추이 찜 해제 시 목표가 행 숨김 수정

### 플로팅 — 찜 목록 관리에서 삭제 버튼이 동작하지 않던 버그 수정
- **버그**: `swb-ui.js`의 `renderWatchList`에서 `deleteWatch(deviceId, w.product_id)` 호출 — `deviceId`가 해당 스코프에 없어 **ReferenceError 발생 → 삭제 무시**되고 목록이 그대로 남음
- **수정**: `deleteWatch(productId)`로 시그니처 단순화 + 함수 내부에서 `getDeviceId()` 직접 조회 (라인 1282). 호출부는 `await deleteWatch(w.product_id)` (라인 1244)
- 서버 측은 정상 — 로컬 서버 `DELETE /devices/{did}/watches/{pid}` 204 응답 확인
- E2E 환경 한계: Playwright `page.evaluate`는 Main World라 확장 content script(Isolated World)의 `chrome.storage`에 접근 불가 → 목록 조회가 비어보이는 것은 테스트 환경 문제. 실제 확장은 `storage` 권한으로 정상 동작

### 플로팅 — 가격 추이에서 찜 해제 후 목표가 행이 남아있던 버그 수정
- **버그**: shadow DOM에는 범용 `.hidden { display:none }` 규칙이 없어, 찜 해제 시 목표가 행에 `hidden` 클래스를 추가해도 `display:flex`가 유지되어 **행이 사라지지 않음**
- **수정**: `.swb-target-row.hidden { display: none; }` 규칙 추가 (라인 136). 같은 원인의 `.swb-related.hidden { display: none; }` 규칙도 함께 추가 (라인 173, v0.9.6에서 사용 중이었으나 규칙 누락)

## v0.9.6 (2026-08-05) — [extension] 스크롤 연관 관계 저장 + 핫딜 상단 배치 + [data] 테스트 데이터 정리

### 확장 — 스크롤 연관 상품의 관계 그래프 저장 버그 수정
- **버그**: 연관 상품은 ①페이지 로드 직후(`captureRelated`, parentId 전달)와 ②스크롤로 새 카드 로드 시(`RELATED_FOUND`) 두 경로로 수집된다. 그런데 스크롤 경로는 parentId 없이 `uploadRelatedItems(items, "scroll")`를 호출해 **관계(relations)에 저장되지 않고 products 테이블에만 등록**됐다 — 함께 본 상품 추천 데이터에 구멍
- **수정**: `content.js` — `RELATED_FOUND` 메시지에 현재 페이지의 `parentId`(상품ID) 포함. `background.js` — `uploadRelatedItems(msg.items, "scroll", msg.parentId || null)`로 전달. 상품 페이지면 스크롤 카드도 관계 그래프에 저장. 검색/목록 페이지는 parentId 없음 유지
- 성능 영향 없음 (기존에 이미 저장되던 스크롤 카드의 업로드 경로에 parentId만 추가)

### 팝업 — 핫딜 섹션을 함께 본 상품 위로 재배치
- **이유**: 초기 불만인 "핫딜이 안 보인다"의 근본 해결. 기존 순서 current→related→deals라 함께 본 상품 5개가 로드되면 핫딜이 아래로 밀려 스크롤해야 보였음
- **수정**: `popup.html` 섹션 순서를 current→**deals(핫딜)**→related(함께 본 상품)로 변경. `deals`는 `flex-shrink:0`이라 항상 상단에 노출, 함께 본 상품은 그 아래에서 스크롤로 접근
- 렌더링 검증: Whale 팝업에서 sectionOrder `[current, deals, related]` 확인

### 데이터 — 로컬 서버 테스트 데이터 정리 (SQLite shopwisebar.db)
- **제거 대상**: 모든 명시적 테스트 상품(`rel-src-1`/`rel-tgt-1~5`, `coupang:rel-src`/`rel-tgt`, `local-a`/`local-b`, `coupang:target*` 목표가 테스트, `TESTLONGNAME_0002`) + 테스트 관계 7건 + `test-*` 디바이스 13개와 그 watches/alerts + 테스트 가격 포인트/통계
- **주의**: `coupang:111/222/333`(키보드A/마우스B/손목받침C)도 이름상 테스트로 판단되어 함께 정리
- **결과**: products 530→506, relations 10→0, devices 16→3(실제). 실제 디바이스(watches 4건, alerts 3건)는 유지
- 백업: `/var/folders/3_/.../T/opencode/shopwisebar_backup_*.db` (파괴적 변경 대비)

## v0.9.5 (2026-08-05) — [extension] 팝업에서 찜 목록 제거 + 메인 스크롤 추가 (함께 본 상품·핫딜 공간 확보)

### 팝업 — 찜 목록 섹션 제거
- **이유**: 팝업 세로 공간(600px)이 부족해 함께 본 상품 5개가 화면에 아예 안 보이는 문제. 찜 목록은 플로팅 메뉴(찜목록 아이콘)에 이미 존재해 기능 손실 없음
- **제거**: `popup.html`의 `#listSection`(찜 목록+몰 필터+접기 토글)과 `#confirmDlg` 삭제
- **코드 정리**: `popup.js` — `loadList()`, `renderList()`, 몰 필터 이벤트, `listToggle` 리스너, `confirmDialog`(찜 삭제 확인용), `staleCheckLabel()`, `watchCache`/`watchMallFilter` 제거. `mallMeta`/`mallBadgeHtml`은 연관 상품·핫딜에서 공용으로 쓰므로 유지. watchBtn/targetClear/init의 `loadList()` 호출 제거
- **스타일 정리**: `popup.css` — 찜 목록 전용 스타일(`.watch-item`/`.watch-price`/`.watch-check`/`.mall-filter`/`.watch-unwatch` 등) 제거, 연관·핫딜 공용(`.watch-thumb`/`.watch-badge`/`.watch-name`)과 함께 본 상품 토글(`.list-toggle`)은 유지

### 팝업 — 메인 스크롤 추가 + 레이아웃 정리
- **이유**: 찜 목록 제거 후에도 current+related+deals 섹션이 600px를 넘으면 핫딜이 잘림
- **수정**: `body`에 `overflow-y: auto` 추가 — 섹션이 화면을 벗어나면 팝업 전체가 스크롤
- **핫딜 목록 내부 스크롤 제거**: `.deal-list`의 `max-height: 168px; overflow-y: auto` 제거 — v0.7.6의 "찜 목록 공간 확보" 목적이 사라져 메인 스크롤로 전체 표시
- **헤더 sticky 유지 (v0.9.5)**: 스크롤해도 헤더(똑바 로고)는 최상단 고정 유지 — v0.9.5 중 sticky 해제를 시도했으나 사용자 선호로 복원
- **스크롤바 커스텀**: 기본 OS 스크롤바(투박) 대신 6px 얇은 스크롤바로 대체
- **섹션 타이틀/여백 통일**: 핫딜(`.deals`) 패딩 10px→12px 상하 일관, `#related` 배경 흰색 + 타이틀 13px→12px로 핫딜과 통일 — 섹션 전환 시 높이 점프 없음
- 렌더링 검증: Whale 팝업에서 body `overflow-y:auto` + 얇은 스크롤바, 콘텐츠 채웠을 때 scrollable + 스크롤 이동 확인. **핫딜 섹션이 viewport 하단 밖에 있지 않음**(스크롤 없이도 핫딜 헤더 노출). `#listSection`/`#confirmDlg` 부재 확인
- 성능 영향 없음 (API 호출 1회 감소: `/devices/{did}/watches`)

## v0.9.4 (2026-08-05) — [extension] 플로팅 메뉴 직각 배치 + 페이지 정보(제작자/버전) + [server] alerts 500 수정

### 플로팅 메뉴 재배치 (ext) — 직각 배치
- **배치 변경**: 기존 FAB 왼쪽 세로 6개 나열 → **FAB 중심 직각 배치**. **메뉴 원점을 FAB 중심(`right:calc(20px+23px); bottom:25vh`)으로 이동**해 좌표가 FAB 세로축과 어긋나던 문제(왼쪽 치우침) 해결. 최종 배치: **위=핫딜·알림, 왼쪽=가격추이·찜목록(FAB에 가깝게 x=-60), 아래=설정·사용법·디버그** — 핵심 기능은 왼쪽, 나머지는 위/아래로 분산
- **라벨 겹침 수정**: 위/아래 아이콘 간격 48px → **72px** (라벨 높이 20px+마진이 이웃 아이콘과 겹치던 문제). **위 그룹(핫딜·알림) 라벨 방향 left로** — 아이템 위로 나가며 위쪽 이웃(알림) 아이콘과 겹치던 것을 왼쪽 배치로 해결(왼쪽 열과 y 범위 상이해 충돌 없음). 아래 그룹은 아이템 아래 표시 유지
- **애니메이션**: 메뉴 열림 시 order 순서(위→왼쪽→아래) 스태거 펼침, 닫힘 시 딜레이 리셋. FAB 180도 회전 유지
- **디버그 아이콘 실시간 반영**: `debugEnabled` 토글 시 `chrome.storage.onChanged`로 **새로고침 없이** 메뉴에 디버그(버그 아이콘) 즉시 추가/제거
- **버그 아이콘 추가 (ext)**: `ICON.bug` SVG 신규

### 확장 — 가격/관계 3회 중복 업로드 방지 (동시 실행 잠금)
- **원인**: `tabs.onUpdated(complete)` + `tabs.onActivated` + `webNavigation.onHistoryStateUpdated`가 탭 전환 직후 거의 동시에 `captureProduct`를 호출. `lastCapture` 쿨다운은 **비동기 `chrome.storage.local.get` 경합**으로 막지 못해 같은 상품이 **정확히 3회** `/products`+`/prices` 업로드 → 서버에서 같은 초 UNIQUE(product_id, captured_at) 충돌로 **prices 500**, 관계 저장도 동시 POST로 **uq_rel_pair 충돌 500** 유발
- **수정**: `background.js` — `withCaptureLock()` 인메모리 Map으로 **동일 탭의 captureProduct를 직렬화** (captureProductInner 리팩터링)
- **연관 상품 업로드 병렬화**: 순차 `await` 루프(상품당 ~3.5s)가 40개면 2분 넘게 걸려 스크롤 직후 대기 시간이 길었다 → **`mapLimit(items, 5)` 동시성 제한 병렬 처리**로 단축 (서버 부하 억제)

### 서버 — alerts 500 수정 (PostgreSQL naive/aware 비교)
- **원인**: `GET /devices/{did}/alerts`가 실서버(PostgreSQL)에서만 HTTP 500. `DateTime(timezone=True)` 컬럼이 PG에선 **aware datetime**으로 반환되는데 `since`는 `replace(tzinfo=None)`으로 **naive** 처리 → `latest.captured_at <= since` 비교 시 `TypeError: can't compare offset-naive and offset-aware datetimes`. SQLite는 naive라 로컬 재현 불가였음
- **수정**: `watches.py` — `_naive()` 헬퍼로 비교 시 항상 naive 통일 (sold_out_at/captured_at)
- **가격 중복 업로드 500 수정**: `products.py` — 같은 초 중복 POST 시 `UNIQUE(product_id, captured_at)` `IntegrityError` 발생 → PG 세션이 requires-rollback 상태가 되어 commit 시 500. **IntegrityError 시 즉시 rollback 후 성공 응답** 반환 (중복 요청이므로 직전 요청이 갱신 완료). 로컬 동시 3회 POST → 3건 모두 201 확인
- **관계 저장 동시성 500 수정**: `relations.py` — 같은 source로 동시 POST 시 existing 조회 시점에 없던 쌍이 먼저 INSERT돼 `uq_rel_pair` 충돌 → **IntegrityError 시 rollback 후 기존 행 weight 증가만 수행**하고 성공 처리. 로컬 동시 3회 POST → 3건 모두 200 확인(수정 전 500 재현)
- **추가 성능 최적화**: POST `/products`는 확장이 응답 body를 쓰지 않는데 통계 쿼리 5개(_product_out)를 실행 → **기본 필드만 반환**으로 변경 — 연관 카드 N개 순차 업로드의 쿼리 × N 지연 제거 (로컬 31ms 확인)

### 페이지 정보 표시 (ext)
- **옵션 페이지**: "확장 버전" 행 추가 (`chrome.runtime.getManifest().version`) + 하단에 제작자(BoRaSaRang)·문의(이메일)·GitHub 링크 카드
- **사용법(onboarding) 페이지**: 하단에 제작자·문의 이메일·GitHub 소스 코드 카드 추가
- **팝업 헤더 정리**: `.header-desc`/`.status` ellipsis 처리 + 로딩 안내 문구 단축 — 320px 폭에서 줄바꿈 방지
- 성능 영향 없음 (순수 렌더링/CSS, storage 이벤트 1회만)

## v0.9.3 (2026-08-05) — [extension+server] 전용 디버그 창 + 중앙 로그 + 연관 업로드 500 수정 (T-82→T-83)

### 확장 — 전용 디버그 창 & 중앙 로그 (T-83)
- **중앙 로그 스토리지 (ext)**: `debug.js` 전면 개편 — 모든 로그가 `chrome.storage.local["debugLog"]`에 **중앙 누적**(최대 2000줄 FIFO). **SW 종료/팝업 닫기/탭 이동과 무관하게 지우기 전까지 유지** (기존 메모리 링 버퍼는 휘발 문제 — T-82 옵션 A 대체)
- **전용 디버그 창 (ext)**: `debug-view.html/.css/.js` 신규 — `chrome.windows.create({type:"popup"})` OS 레벨 분리 창(우상단 고정, 1.5배 폭). **어느 탭을 봐도 항상 떠 있고** 닫기 전까지 계속 누적/2초 자동 갱신. **단축키 mac `Command+D` / 그 외 `Ctrl+Shift+Y`** 토글(manifest commands, 웨일 확인 완료). 로그 뷰어: 색상(ERROR/WARN/PERF/DEBUG) + 자동스크롤 + 레벨·몰·탭 필터 + 검색 + 전체 복사 + 지우기 + 일시정지
- **다중 탭 로그 통일 (ext)**: content script는 storage를 직접 쓰지 않고 `DEBUG_LOG` 메시지로 background에 위임 → background가 `sender.tab`로 **탭ID/url/몰 태깅** 후 중앙 기록 → **쇼핑탭 여러 개를 오가도 로그가 하나로 모임** (탭 필터로 구분)
- **팝업 정리 (ext)**: 내장 `debugPanel`·토글·복사/숨기기 제거 → 헤더 🛠 "디버그 창 열기" 버튼(`OPEN_DEBUG` 메시지). **`debugEnabled`(설정 '디버그 패널 표시')가 켜져 있을 때만 🛠 버튼 노출**, 해제 시 숨김. `options.js` 스위치 유지(로그 on/off)
- **설정에 단축키 표기 (ext)**: 옵션 페이지 디버그 카드에 단축키(⌘D / Ctrl+Shift+Y) 표시 + kbd 스타일 — `chrome://extensions/shortcuts`에서 변경 안내
- **전처리 성능 (ext)**: content 위임은 즉시(비동기), ext(background/popup/창)는 디바운스(300ms) 배치 저장 — 로그마다 storage set 없음

### 서버 — 연관 상품 업로드 HTTP 500 수정
- **원인**: `POST /products`에서 `name`/`url`/`image`가 DB 컬럼 최대 길이(`String(512/1024)`)를 넘으면 **Postgres는 오류 → 500**(SQLite는 무시해 로컬 재현 불가). 네이버 연관 카드의 장황한 상품명이 512자 초과해 '연관 상품 업로드 실패 HTTP 500' + 관계 저장 누락 발생
- **수정**: `server/app/routers/products.py` — 저장 전 `name[:512]`/`url[:1024]`/`image[:1024]` 클램프. 실서버 600자 name 요청 500→201 확인(로컬 + Render 재현)
- 성능 영향 없음. `node --check`/`py_compile` 통과

## v0.9.2 (2026-08-04) — [server+extension] 목표가 UI 디자인 통일 + 목표가 해제 버그 수정

- **목표가 해제 버그 수정 (server)**: `PUT /devices/{did}/watches/{pid}`에 `target_price`가 없면(해제 요청) **기존 값을 유지**해 해제가 안 되던 문제 → 명시적으로 `None` 초기화 — 팝업/플로팅의 `설정 해제` 버튼·`PUT {}` 요청이 실제로 목표가를 지우도록 (775724a)
- **팝업 목표가 행 UX (ext)**: "현재 가격이 기본으로 채워져요" 힌트 문구 제거 → **목표가 상태 라벨**(`N원 이하 알림 중` 파랑 강조 / `목표가 미설정`) 우측 정렬 + **설정 해제** 버튼(목표가 있을 때만 활성) + 입력/버튼 우측 정렬
- **찜 목록 가격+상태 한 줄 정렬 (ext)**: `watch-price-row` flex — 가격 왼쪽, 상태(품절/목표가 알림/확인 필요) 오른쪽 정렬
- **품절 행 배경 (ext)**: `.sold-out-row` 연분홍 배경 + hover 강조 (팝업 + 플로팅 swb-ui 동일)
- **함께 본 상품 접기 (ext)**: 힌트 문구 "이 상품을 본 분들이 함께 본 상품"으로 변경 + 헤더에 접이기 토글(▾/▸, `relatedToggle`/`.collapsed`)
- **아이콘 교체 (ext)**: `scripts/gen_icon.py` 신규 생성기 — 남색 하락 화살표 v2 (icon16/48/128 PNG 리사이즈)
- 성능 영향 없음 (순수 CSS/JS 렌더 변경, 서버는 PUT 분기 1줄)

## v0.9.1 (2026-08-04) — [server+extension] 목표가 알림 + 품절 감지 + 추천/추이 UX

- **목표가 알림**: 찜에 목표가 설정 가능 (`Watch.target_price` + 팝업 입력 UI) — 가격이 목표가 이하로 내려가면 `target_reached` 알림 (직전 가격이 목표가 이상일 때만 1회, 회복 후 재하락 시 재알림)
- **품절 감지**: 상품 페이지 품절 시 확장이 자동 보고 (`Product.sold_out_at` + `POST /products/{id}/sold-out`) → 찜 목록 '품절' 배지 + `sold_out` 알림 (재판매 시 가격 캡처가 자동 해제)
- **컬럼 마이그레이션**: startup `_ensure_columns` — PostgreSQL `ADD COLUMN IF NOT EXISTS` / SQLite PRAGMA+ALTER (create_all 한계 보완)
- **버그 수정**: ① 품절 상품이 목표가 검사를 재수행해 알림 무한 반복 → 품절이면 하락/목표가 검사 생략 ② since와 캡처 시각이 동일(초 절단)하면 재감지 → `<=` 비교 ③ `content.js` isSoldOut이 쿠팡 if 블록 안 `const`로 선언돼 블록 밖 return에서 ReferenceError → 쿠팡 추이 패널 로딩 중단 (함수 레벨 `let`로 수정, 883e187)
- **관계 저장 500 수정**: `POST /products/relations`가 targets 중복(같은 상품이 여러 연관 섹션에 노출)을 제거하지 않아 `uq_rel_pair` unique 제약 위반 → 500 — 확장 captureRelated(40개 카드)의 관계 저장이 항상 실패해 '함께 본 상품'이 비어 있었음. `dict.fromkeys`로 중복 제거 (0ffca63) — 로컬/실서버 중복 target 200 확인, 미레오 9590025132 연관 3건 weight 3 수집 확인
- **관계 기반 추천 확장**: 팝업 '함께 본 상품' 섹션 (GET /related 재사용, 5개, 클릭 시 새 탭)
- **추이 그래프 UX**: 최저가 점선 표시선 + 하락 구간 파란 굵은 선/상승·평탄 회색 + 최저/최고점 마커
- **알림 뷰 배지**: 목표 도달(보라)/품절(빨강)/하락(파랑) 타입별 표시
- 성능: 알림 감지는 상품당 500포인트 제한 조회 유지, 신규 컬럼은 인덱스 불필요(소량 조회)

## v0.9.0 (2026-08-04) — [server+extension] Phase 3: 상품 관계 그래프 (함께 본 상품)

- **연관 상품을 관계로 저장**: 상품 페이지 방문 시 연관/추천 섹션의 카드를 부모 상품과 연결 (`product_relations` 테이블, 신규) — 같은 쌍이 반복 노출되면 weight(강도) 증가, 무방향 그래프 (A→B 2회 + B→A 1회 = 강도 3으로 합산)
- **API**: `POST /products/relations` (bulk upsert, weight += 1) / `GET /products/{id}/related?limit=` (양방향 합산, weight 내림차순, 상품 정보 포함)
- **확장**: background.js `captureRelated`가 parentId를 전달해 관계 업로드 (목록 페이지는 관계 저장 안 함), 플로팅 추이 패널에 **"함께 본 상품"** 섹션 — 연관 5개, 이름+현재가, 클릭 시 새 탭 오픈
- 로컬 E2E: 관계 저장(중복 weight 증가) → 양방향 합산 조회 PASS (2+1=3, 2)
- 성능: 관계 저장은 상품 페이지 1회 호출(최대 10쌍), 조회는 인덱스(PK 유니크) 사용

## v0.8.28 (2026-08-04) — [extension] 핫딜 최저가 배지 표시 (reason=low)

- 서버 v0.8.26이 하락 상품 부족 시 **역대 최저가 갱신 상품**(reason=low)으로 채우는데, 팝업/플로팅 핫딜 목록이 `▼ 0%`로 표시해 어색
- **수정**: `popup.js` + `swb-ui.js` — `d.reason === "low"`면 `▼ 0%` 대신 **"최저가"** 배지 표시
- 성능 영향 없음

## v0.8.27 (2026-08-04) — [server] 가격 삭제 API variant 지원 / [extension] 쿠팡 품절 price-container 불신

- **알림 오탐 발견**: 오리온 황치즈칩(9648038896)이 variant=None 9,880원(품절 잔존, 23:57)을 다시 저장 → variant=None 그룹에서 20,530(수동) vs 9,880 = **52% 하락 오탐 알림** — v0.8.20에서 지웠던 잔존값이 재수집된 원인: content.js가 품절이어도 `.price-container`(잔존 판매가)를 신뢰
- **수정**:
  - `content.js`: 쿠팡 분기 `if (pcEl && !isSoldOut)` — 품절이면 price-container 불신 (스킵)
  - `products.py`: `DELETE /products/{id}/prices/{price}?variant=` 추가 — variant 생략=전체, `__none__`=NULL variant, 그 외=해당 variant만 (실제 딜 variant 보존하며 정밀 정리)
- **정리**: 오리온 variant=None 9,880 / 20,530(수동) / 12,345(VARIANT_TEST_001) 삭제 — variant=95728194224의 실제 9,880과 variant=95826327022의 20,530×2는 보존
- 알림 재확인: 오탐 제거, 정상 하락(10,600→10,520)만 남음

## v0.8.26 (2026-08-04) — [server] 핫딜 추천 강화 (역대 최저가 갱신 채움 + reason)

- 하락 상품(drop 5%+)이 부족할 때 **역대 최저가를 갱신한 상품**(기간 전 최저가 대비 ≤)으로 부족분 채움
- 같은 product_id의 variant 중복은 drop% 최대 1건만 (v0.8.21 규칙 유지)
- 응답에 `reason` 필드 추가: `drop`(하락) / `low`(최저가 갱신)
- 로컬 검증: 7일/30일 drop 10건 정상, variant 중복 없음, low 쿼리 문법 OK
- 실서버: 현재 하락 상품 없음(전부 동일가 2포인트) → 0개 반환 정상 (데이터 축적 후 동작)

## v0.8.25 (2026-08-04) — [extension] 추이 패널 로딩 중 이전 값 초기화

- **문제**: 가격 추이 로딩 중(서버 조회 동안) 이전 상품의 가격/최저·최고가/이력 건수/기간 라벨이 그대로 남아 있다가 로딩 완료 후 바뀌어 애매하게 보임
- **수정**: `loadTrend`의 로딩 인디케이터 표시 시점에 현재 가격(—)/변동/최저·최고/이력 건수/x축 라벨을 전부 비움 → 로딩 완료 후 새 값으로 채움
- 성능 영향 없음 (DOM textContent 6회)

## v0.8.24 (2026-08-04) — [extension] 추이 패널 크래시 수정 (extract url 인자 방어)

- **버그**: v0.8.23에서 `Extractor.extract`가 `url.match()`를 사용하도록 바뀌었는데, **플로팅 추이 패널(swb-ui.js)은 url 인자 없이 `extract(parsed.mall)`로 호출** → `undefined.match` 크래시 → `loadTrend`가 로딩 표시(가격 이력 불러오는 중…)를 띄우기 전에 중단 (사용자: "웨일에선 로딩중도 안뜸", 브랜드 스토어 NUPHY AIR60 11106441044 사례 — 크롬은 아직 구버전이라 정상 동작)
- **수정**:
  - `content.js`: `url || window.location.href` 기본값 방어 (어떤 경로에서 호출돼도 안전)
  - `swb-ui.js`: 추이 패널에서 `extract(parsed.mall, location.href)`로 현재 URL 명시 전달 (쿠팡 variant 추출 정확도도 함께 확보)
- CDP 재현: url 미전달 시 `Cannot read properties of undefined (reading 'match')` 크래시 확정 → 수정 후 기본값 경로 검증
- 성능 영향 없음

## v0.8.23 (2026-08-04) — [extension] 스마트스토어 SPA 전환 가격 오염 방지 (JSON-LD 검증)

- **원인 규명 (CDP 실측)**: 독거미 L99 키보드 `12270743644`(화이트 투명블루 102,020원)와 `12270743646`(화이트그레이 109,520원)은 **같은 제품의 색상별 개별 상품** — 색상/옵션 클릭이 `history.pushState`로 다른 상품 페이지로 이동 (사용자: "주소가 바뀌네")
- **레이스**: URL이 먼저 바뀌고 DOM이 늦게 교체되는 동안 캡처가 발생 → 옛 상품 가격이 새 product_id로 저장 (서버 기록: 46에 102,020 5회 / 44에 109,520 4회 — 양방향 오염) → 팝업(서버 last_price)이 틀린 가격 표시
- **수정**: `content.js` 네이버 분기 — head의 JSON-LD(`mpn`/`productID`)와 URL 상품번호가 **불일치하면 price=null**(캡처 스킵), 렌더 완료 후에는 JSON-LD `offers.price`를 **정확한 현재 판매가로 우선 사용** (기존 "상품 가격" 라벨 로직은 폴백)
- **오염 정리**: 46의 102,020(5개) / 44의 109,520(4개) 삭제 → last_price 각각 109,520 / 102,020 정상 복구
- 성능 영향 없음 (JSON-LD 파싱 1회)

## v0.8.22 (2026-08-04) — [extension] 쿠팡 할인 상품 정가 오탐 수정 (일반할인가 우선)

- **정가가 판매가로 저장되던 버그 수정**: 할인 상품(와우할인가/일반할인가)의 `.price-container`는 `"와우할인가 44% 22,500원 12,380원 할인받기 일반할인가 44% 22,500원 12,510원"` 구조 — **정가(22,500)가 첫 금액**이라 기존 첫 금액 규칙이 정가를 저장 (사용자 실측: 오트밀 미니바이트 12,510이 22,500으로 표시)
  - CDP 실측으로 `"일반할인가"` 섹션의 **마지막 금액 = 실제 구매가** 확정 → 라벨 유무 분기 (라벨 없으면 기존 첫 금액 규칙 — 일반 상품/오리온 호환)
- 오염 정리: 9677792314의 22,500(정가)/12,380(와우할인가) 삭제 — 새 캡처부터 12,510 저장
- CDP 검증: 오트밀 → 12,510 ✓ / 오리온 → 21,930 ✓
- 성능 영향 없음

## v0.8.21 (2026-08-04) — [extension] 팝업 핫딜 렌더 HTML 문자 노출 수정

- **팝업 핫딜 이전가 HTML 문자 노출 수정**: `deal-before`(이전 가격)를 `.textContent`에 HTML 문자열(`<span class="deal-before">…</span>`)로 넣어 **태그가 그대로 텍스트로 표시**되던 버그 — 실제 화면에 `@에스쁘아 워터 스플래쉬 선크림… 9,000원 <span class="deal-before">40,000원</span>`처럼 노출됨 — `createElement` + `textContent`로 수정 (swb-ui.js와 동일 패턴)
- 사용자 실측 예시 기반 수정, 찜 목록 렌더는 정상 확인

## v0.8.20 (2026-08-04) — [server] 쿠팡 variant=None 핫딜 오탐 제거 + variant 응답 누락 수정

- **핫딜 오탐 수정 (핫딜이 아닌데 핫딜로 표시되는 상품들)**: 쿠팡 variant(None) 파티션에 서로 다른 수량 옵션 가격(1개 10,980 / 2개 20,530 / 3개 27,530 / 품절 잔존 9,880)이 섞여 있어 옵션 간 가격 차이를 "하락"으로 계산 → 오리온 51.9%(9880←20530, 실제로는 서로 다른 옵션) 같은 오탐 발생. **쿠팡은 variant 미지정 포인트를 핫딜 계산에서 제외** (네이버/올리브영은 variant 개념이 없어 None 그대로 유효 — 포함)
  - CDP 실측 확인: variant는 DB에 정상 저장되고 있었음 (GET /prices 응답에서만 누락돼 "None인 것처럼" 보임)
- **GET /prices 응답 variant 누락 수정**: `GET /products/{id}/prices` 응답에 variant 필드가 빠져 있어 팝업/추이 그래프가 variant 정보를 받지 못하던 버그 (products.py:218)
- 로컬 SQLite 검증: 쿠팡 variant 하락(V1 9880←20530)만 검출, None 파티션 하락(20530←27530) 제외, 네이버 None 하락은 유지 — PASS
- 성능 영향: 없음 (기존 인덱스)

## v0.8.19 (2026-08-04) — [extension+server] variant(수량 옵션)별 가격 전면 분리

- **핫딜 누락 수정**: 같은 가격이 초 단위로 중복 저장(동시 캡처 race)되면 직전 포인트가 같은 가격이 되어 하락률 0%로 계산 — 오리온 실질 52% 하락(20,530→9,880)이 핫딜에서 사라진 문제. 연속 동일 가격 그룹을 압축 후 비교
- **핫딜 variant 분리**: variant(쿠팡 수량 묶음/딜)별 PARTITION — variant A의 하락을 variant B 가격과 섞어 계산하지 않음
- **서버 variant 조회**: `GET /products/{id}?variant=`, `GET /products/{id}/prices?variant=` — variant 지정 시 해당 옵션의 last_price/최저가/평균가/이력만 응답 (지정 없으면 기존 전체 동작, 네이버/올리브 영향 없음)
- **팝업/추이 variant 반영**: 팝업 EXTRACT에 url 전달 + 현재 탭 variant로 서버 조회 — 수량 변경 시 배지/통계/그래프가 해당 수량 기준으로 표시
- 성능 영향: 없음 (기존 인덱스로 variant 필터 커버)

## v0.8.18 (2026-08-04) — [extension+server] 이름 갱신 출처 구분 (카드 이름 오염 방지)

- **회귀 방지**: v0.8.17의 "이름 항상 갱신"이 검색/연관 카드 캡처(짧은 카드 이름)가 상세 페이지 이름을 덮어쓰는 문제 유발 가능 — `ProductUpsertIn.source` 추가
  - `detail`(상세 페이지 실시간 .product-title) → 항상 갱신 (수량 반영)
  - `card`(검색/연관 카드) → 최초 1회만 (기존 정책 유지 — 네이버/올리브 포함)
- 구버전 확장(요청에 source 없음)은 최초 1회 동작 유지 (하위 호환)
- 성능 영향 없음

## v0.8.17 (2026-08-04) — [extension+server] 쿠팡 수량 변경 시 상품명 실시간 반영

- **상품명 실시간 추출**: og:title은 페이지 로드 시 고정(수량 변경 미반영, "1개" 유지) — CDP 실측으로 쿠팡 실시간 상품명 요소 `H1.product-title` 확정 (수량 클릭 시 "오리온 황치즈칩 쿠키, 256g, 1개/2개/3개" 실시간 변경) — EXTRACT title을 `.product-title` 우선으로 교체
- **팝업/플로팅 추이 자동 해결**: 두 화면 모두 EXTRACT title 사용 (popup.js liveTitle, swb-ui.js splitTitle)
- **찜 목록 이름 갱신**: 서버가 이름을 최초 1회만 저장하던 정책 → 매 캡처 최신 이름 반영 — 찜 목록/등록에 수량 반영 이름 표시
- 성능 영향 없음

## v0.8.16 (2026-08-04) — [server] 오염 포인트 삭제 시 last_price 재계산

- **DELETE 후 last_price 잔존 버그 수정**: 오염 가격 포인트(24,200원 등)를 삭제해도 `product.last_price`가 삭제된 값으로 남아 팝업(서버 last_price 표시)이 삭제값을 계속 보여주던 문제 — 삭제된 값이 last_price면 **최근 남은 포인트로 자동 복구**
- 정리: 오리온 24,200(추천 카드)/13,800×2/11,900 삭제 + last_price 20,530으로 수동 정상화
- 성능 영향 없음

## v0.8.15 (2026-08-04) — [extension] 쿠팡 판매가 요소 직접 추출 (body 첫 금액 폴백 제거)

- **판매가 추출 1순위 확정**: CDP 실측(웨일 9222)으로 쿠팡 판매가는 `.price-container` 요소 1개에 항상 존재함을 확인 (오리온 1개 10,980 / 2개 20,530 / 3개 27,530원 전부 정확)
- **body 첫 금액 폴백 제거**: lazy 로드되는 추천 카드(글로벌특가 등)의 14,900/13,800/11,900/12,510원이 body에 끼어들어 팝업 EXTRACT·플로팅 추이에서 오탐 표시되던 문제 — 판매가 요소가 없으면 수집 스킵
- **vendorItemId = 수량 묶음 옵션 확인**: 95788422542(1개)=10,980 / 95826327022(2개)=20,530 / 95871591795(3개)=27,530 — variant(v0.8.10) 분리 유지
- `% 매치` 폴백, PRICE DEBUG 임시 로그 제거
- 성능 영향 없음

## v0.8.10 (2026-08-04) — [extension] 쿠팡 vendorItemId(딜) variant 분리

- **옵션/딜별 가격 분리**: `vendorItemId`를 variant로 추가 추출 — 같은 productId라도 vendorItemId(딜)마다 가격이 다른데 itemId만 추출해서 **옵션별 가격이 한 상품에 섞이던 문제** 해결 (오리온 황치즈칩쿠키 9,880/14,900/27,530 혼합 사례)
- 성능 영향 없음

## v0.8.9 (2026-08-04) — [extension] 품절 상품 캡처 완전 스킵 (잔존 가격 요소 제거)

- v0.8.8에서 품절 상품의 `.total-price[data-price]`도 잔존값(14,900)을 가질 수 있음이 확인됨 — **품절이면 total-price 포함 전부 무시하고 무조건 스킵** (price=null → 캡처 안 함, 오리온 황치즈칩 품절 14,900원 사례)
- 성능 영향 없음

## v0.8.8 (2026-08-04) — [extension] 쿠팡 품절 상품 가격 오탐 방지

- **품절 상품 캡처 제외**: 쿠팡 품절(품절/일시품절/재입고 알림) 상품은 판매가 요소(`total-price`)가 사라지는데 body에 잔존하는 이전 가격(14,900 등)이 폴백으로 잡히던 문제 — 품절이면 판매가 요소만 허용하고 `% 매치`/`body 첫 금액` 폴백 금지 (오리온 황치즈칩쿠키 품절 14,900원 오탐 사례)
- 성능 영향 없음

## v0.8.7 (2026-08-04) — [extension+server] 정가 오탐 제거 + 핫딜 노이즈 필터

- **네이버 브랜드 정가(원가) 진동 수정**: `del/s/취소선/deal-before/원가` 요소를 DOM clone에서 제거 후 "상품 가격" 라벨 금액 추출 — 판매가(9,000)와 정가(40,000)가 함께 렌더되어 번갈아 캡처되던 문제 해결 (에스쁘아 77.5% 하락 오탐 사례)
- **쿠팡 정가 오탐 수정**: data-price 추출을 판매가 전용(`.total-price[data-price]`)으로 한정 — 정가(21,600)도 data-price를 가져 일반 `[data-price]` 폴백이 정가를 잡던 문제 해결 (엑씨 사생활 필름 사례)
- **핫딜 노이즈 필터**: drop 5% 미만(아이패드 0.1%/0.0% 등 소폭 변동) 상품을 핫딜에서 제외 (server)
- 오염 포인트 정리: 에스쁘아 40,000원 4건, 엑씨 21,600원 2건 삭제
- 성능 영향 없음

## v0.8.6 (2026-08-03) — [extension] 찜 배지 클리핑 수정 (viewport 고정 오버레이)

- **배지가 반 잘리던 문제 수정**: 카드 내부 absolute → **viewport 고정(fixed) 오버레이**로 전환 — 이미지가 컨테이너 위로 삐져나오거나 overflow:hidden인 카드 구조에서도 잘리지 않음
- 스크롤/리사이즈 시 배지 위치 재계산, 숨김 카드(lazy)는 display:none

## v0.8.5 (2026-08-03) — [extension] 목록/검색 페이지 찜 상품 배지

- **찜 상품 배지**: 검색/목록 화면에서 내 찜 상품 카드 우상단에 `★ 찜 N원` 오버레이 (서버 찜 목록과 대조, 카드 클릭 방해 없음 — pointer-events:none)
- **찜 목록 캐시**: background에 30초 TTL 캐시 + `WATCHES_GET`/`WATCHES_INVALIDATE` 메시지 — 팝업/플로팅에서 찜 추가·해제 시 캐시 즉시 무효화
- 배지 적용 시점: 페이지 로드 직후 + 스크롤로 새 카드 로드 시 (이미 배지된 카드는 스킵)
- 성능 영향: 페이지당 1회 WATCHES_GET (30초 TTL), 배지 DOM 삽입은 찜 상품만

## v0.8.4 (2026-08-03) — [extension] 카드 상품명 잡음 문구 필터

- **"새 창에서 열림" 등 UI 문구 오매치 방지**: 네이버 쇼핑 카드에서 a 태그/alt의 잡음 문구가 상품명으로 저장되던 문제 — 정확 일치 문구 목록으로 필터 (img alt 폴백에도 적용)
- 성능 영향 없음

## v0.8.3 (2026-08-03) — [extension] 네이버 쇼핑 상점명 오매치 최종 수정

- **이름 후보 중 최장 텍스트 선택**: 네이버 쇼핑 검색 `store:main:` 카드는 스토어명 요소가 상품명보다 먼저 매치되어 상점명("PC PRO" 등)이 이름으로 저장되던 문제 — 상품명이 항상 가장 긴 점을 이용
- `@스토어명 ` 접두사 제거 (네이버 상점 이미지 alt 패턴)
- v0.8.2의 a[href] 내부 우선은 `store:main:` 카드 구조에선 효과가 없어 최장 텍스트 방식으로 교체
- 기존 오염 이름은 브라우저 세션 재시작 후 재검색 시 서버 upsert로 갱신

## v0.8.2 (2026-08-03) — [extension] 네이버 쇼핑 검색 카드 상품명 추출 수정

- **스토어명 오매치 수정**: 네이버 쇼핑 검색 카드에서 상점 이름("샤인디지탈" 등)이 상품명으로 저장되던 문제 — 상품 링크(`a[href]`) 내부의 이름 요소를 우선 사용
- 이미 잘못 저장된 이름은 다음 캡처 시 서버 upsert로 자동 갱신
- 성능 영향 없음

## v0.8.1 (2026-08-03) — [extension] 카드 가격 추출 할부 문구 오매치 수정

- **"월 N원" 할부 문구 오매치 방지**: 쿠팡 검색 카드의 "월 28,418원"(무이자 할부)이 상품 가격보다 먼저 매치되던 문제 — `firstCardPrice()` 헬퍼로 통합 (월/개월 문구 제외, 올리브영 카드에도 적용)
- 원격 오탐 포인트 정리: Z Fold8 28,418원 삭제 (min 958,800 정상화)
- 성능 영향 없음

## v0.8.0 (2026-08-03) — [extension] Phase 2: 목록/검색 페이지 캡처

- **MallParser.detectMall 추가**: 상품 페이지가 아니어도 몰 판별 (`kind: product|listing`) — 쿠팡 검색(`/np/search`), 네이버 쇼핑 검색, 스마트스토어/브랜드 카테고리, 올리브영 카테고리/기획전
- **목록/검색 페이지 카드 수집**: 상품 페이지에서만 동작하던 연관 카드 수집을 검색/목록 페이지로 확장 (초기 1회 + 스크롤 시) — 기존 파이프라인(품목 등록 + 가격 포인트) 재사용, 1회 40개 상한 유지
- **쿨다운 정규화**: 목록 페이지는 pathname 기준 10분 쿨다운 (검색어/정렬 변경에 따른 폭주 방지)
- `store:`/`brand:` productID 접두사 규약 유지 확인
- [E-EXT-URL-2001] 목록 페이지 지원 (더 이상 상품 페이지만 요구하지 않음) / 성능 영향: 페이지당 40개 상한 + 쿨다운으로 제한

## v0.7.7 (2026-08-03) — [extension/server] 쿠팡 가격 추출 안정화 + 이상값 정리 API

- **쿠팡 가격 추출 개선**: `data-price` 속성 우선 (쿠팡이 실제 판매가에 부여하는 표준 속성) — 정가/쿠폰가/사전구매 할인가가 여럿 노출되어 첫 `%` 매치가 **번갈아 캡처되던 진동 문제** 해결 (Z Fold8: 2,841,800↔958,800 / 밴드톡: 22,440↔20,190)
- **관리용 포인트 삭제 API**: `DELETE /api/v1/products/{product_id}/prices/{price}` — 이상값(오탐 가격) 일괄 정리
- [E-EXT-NET-1001] 영향 없음 / 성능 영향 없음

## v0.7.6 (2026-08-03) — [extension] 팝업 재편 + 플로팅에 핫딜·알림 추가

- **팝업 재구성**: 순서 변경 — [현재 상품 찜] → [오늘의 핫딜] → [찜 목록]
- **알림 내역은 팝업에서 제거** → 플로팅 패널로 이동
- **팝업 찜 목록 접이식**: 헤더 ▾/▸ 토글로 접고 펼치기
- **플로팅 패널 신규 탭**: 오늘의 핫딜 (1/7/30일 토글, top 5, ▼% 배지) + 알림 내역 (메뉴에 개수 뱃지 표시)
- 플로팅 메뉴 순서: 가격 추이 → 오늘의 핫딜 → 찜 목록 → 알림 → 설정 → 사용법

## v0.7.5 (2026-08-03) — [extension] 플로팅 찜 목록도 개수 + 몰 필터

- 플로팅 패널(상품 페이지) 찜 목록 헤더에 개수 `찜 목록 (N)` + 전체/네이버/쿠팡/올리브영 픽커 (로컬 필터, 팝업과 동일)
- 로딩/오류/빈 상태 표시를 팝업과 동일 패턴으로 통일

## v0.7.4 (2026-08-03) — [extension] 찜 목록 개수 + 몰 필터 픽커

- **찜 목록 개수**: 헤더에 `찜 목록 (N)` 표시
- **몰 필터**: 전체 / 네이버 / 쿠팡 / 올리브영 픽커 버튼 — 로컬 필터(캐시 재렌더, 추가 요청 없음), 필터 결과 없으면 "이 몰에서 찜한 상품이 없습니다" 안내
- **팝업 레이아웃 정리**: 메인 스크롤 제거(고정 600px) → 찜 목록 영역만 내부 스크롤, 알림 목록도 넘침 대비 내부 스크롤(132px)
- **버그 수정**: 찜 목록 렌더 전 초기화 누락으로 '불러오는 중' 행이 목록 위에 남아있던 문제 수정

## v0.7.3 (2026-08-03) — [server] [extension] 핫딜 쿼리 최적화 + 팝업 UX 개선

- **서버 성능**: `/recommendations` N+1 제거 — 상품별 개별 조회(Neon에서 59초) → ROW_NUMBER+LAG 윈도우 함수 단일 쿼리 (0.8초)
  - 복합 인덱스 `price_points(product_id, captured_at)` — 시작 시 IF NOT EXISTS 생성 (기존 테이블 대응)
- **팝업 UX**:
  - 헤더(똑바 타이틀) **sticky 고정** — 스크롤해도 항상 최상단 유지
  - 섹션별 **로딩 인디케이터(스피너)**: 알림 / 오늘의 핫딜 / 현재 상품 통계 / 찜 목록 — 섹션은 처음부터 표시되고 내용만 교체, 실패 시 오류 문구 표시
  - 찜 목록 로딩 행 좌우 여백 14px 정렬 (기존 8px)
- **플로팅 패널**: 가격 추이 차트 자리에 '가격 이력 불러오는 중…' 스피너 표시 (서버 조회 동안)

## v0.7.2 (2026-08-03) — [server] [extension] 오늘의 핫딜 탭 (T-58 확장)

- **서버**: `/recommendations`에 `drop_percent`(할인율%) 추가 — 정렬 기준을 하락액 → **할인율% 큰 순**으로 변경 (기간: 1/7/30일 지원)
- **팝업**: '오늘의 핫딜' 섹션 추가 (기존 상품 위) — 기간 토글(1일/7일/30일), 하락폭 큰 상품 top 5
  - 카드: 썸네일 + 몰 배지 + 상품명 + 현재가 + 취소선 이전가 + ▼% 빨간 배지, 클릭 시 상품 페이지 오픈
- 로컬 검증: `/recommendations` 54.2% → 46.2% → 44.5% 순 정렬 확인

## v0.7.1 (2026-08-03) — [extension] Render 콜드스타트 대응 (공용 API 모듈)

- **문제**: Render 무료 티어는 15분 무요청 시 스핀다운 — 다음 요청이 30~60초 걸려 팝업/찜/가격 추이에서 `E-EXT-NET-1001` 발생 (브라우저가 켜진 동안엔 5분 폴링이 서버를 유지하므로 1~2초 지연은 정상)
- **공용 API 모듈**: `common.js`에 `SWB_API(path, options)` 추가 — fetch 타임아웃 45초(AbortController) + GET 전용 콜드스타트 재시도 2회(3초 간격) + 404 특수 처리 (`NOT_FOUND` 에러 유지)
- **중복 제거**: popup.js / background.js / swb-ui.js의 개별 `api()`/직접 fetch 전부 `SWB_API`로 통합 (직접 fetch 0건)
- **로딩 UX**: 팝업 초기화 중 "불러오는 중…" 표시 (찜 목록 로딩은 기존 유지)
- 버전 0.7.1 — Chrome에서 확장 리로드 필요

## v0.7.0 (2026-08-03) — [server] [extension] 클라우드 전환 (Render + Neon)

- **서버 이전**: 로컬 uvicorn(SQLite) → **Render 무료 웹서비스 + Neon 무료 Postgres 18**
  - 확장을 설치한 모든 사용자가 접속 가능한 공개 서버 (`https://shop-wisebar.onrender.com`)
  - PostgreSQL 전환: `database.py`에서 SQLite 전용 인자(`check_same_thread`) 조건부 처리, `psycopg[binary]`(psycopg3) 추가
  - `DATABASE_URL` 환경변수로 전환 (로컬 개발은 SQLite 유지, Render만 Postgres)
  - 검증: 로컬+원격에서 기기→상품→가격→찜→하락 알림 전체 시나리오 통과 (PostgreSQL 18.4)
- **확장**: `common.js` 서버 주소 → Render URL, `manifest.json` host_permissions + 버전 0.7.0
- 로컬 실측 DB(shopwisebar.db)는 개발용으로 유지 — 프로덕션 데이터는 Neon에서 새로 시작

## v0.6.2 (2026-08-03) — [extension] 연관 카드 정가 오탐 수정 + 플로팅 패널 위치 보정

- **버그**: 연관 상품 카드에서 텍스트의 첫 번째 금액을 가격으로 추출 — 네이버/쿠팡 카드는 취소선 정가(159,990원)가 판매가(114,900원)보다 먼저 나와, 연관 수집 가격이 정가로 저장되고 실제 방문 캡처와 비교 시 "가격 하락" 오탐 알림 발생
- **수정**: 카드 clone에서 `s/del/strike/line-through`(취소선 정가) 요소 제거 후 가격 추출
- **실측 정리**: 에어로클립 159,990원 오탐 이력/통계/알림 기록 삭제 (실가 114,900원만 유지)
- **플로팅 패널 위치 보정**: 기본 위치(플로팅 버튼 왼쪽 중앙 75vh) 유지하되, 브라우저 하단을 넘으면 위로 이동 — `positionPanel()` + ResizeObserver(데이터 로드 후 높이 변화 대응) + 리사이즈 리스너
- **팝업 스크롤**: 팝업 높이 600px 고정 + 내부 스크롤 (브라우저 창이 작을 때 하단 잘림 방지)
- **아이콘 교체**: 쇼핑박스+가격 그래프 합친 모양 (scripts/generate_icon.py 생성기 — /tmp 스크립트 프로젝트로 이관)

## v0.6.1 (2026-08-03) — [server] 알림 감지 버그 수정 (T-66 검증)

- **버그**: `GET /alerts?since=` 폴링에서 직전 가격을 "since **이전** 캡처"로만 찾음 — 찜 이후 첫 하락(모든 캡처가 since 이후)이면 `previous=None` → 하락 미감지
- **수정**: since는 '신규 보고 캡처' 필터로만 사용, 직전 가격은 since 이전이어도 비교 기준으로 채택 (전체 이력 variant별 그룹핑 통합)
- **부수 수정**: since(datetime aware) vs captured_at(naive) 타입 불일치 에러 방지 (`replace(tzinfo=None)`)
- **T-66 알림 실기기 테스트 완료** (크롬+웨일): 찜 → 가격 하락 시뮬레이션 → 5분 내 알림(-25%/-16%), 알림 클릭 → 상품 페이지 오픈, 팝업 알림 내역 기록 확인
- 테스트용 시뮬레이션 가격 3건 삭제 + 일별 통계 재집계

## v0.6.0 (2026-08-03) — [server] 가격 로우데이터 dedup + 일별 통계

- **가격 기록 구조 변경**: 가격이 **변할 때만** `price_points`에 INSERT (같은 가격 재방문은 로우 생성 없음)
  - 문제: 방문마다 로우가 쌓여 같은 가격이 중복 기록 — 가격 추이/차트 왜곡
- **신규 `price_daily_stats` 테이블**: 일별 1행 — `open_price/close_price/low_price/high_price/point_count` (UNIQUE(product_id, stat_date))
  - 방문은 전부 통계로 집계: 기존 178행이 89행으로 dedup, stats 78행 자동 생성
- **race 방어**: `captured_at` 초 단위 절단 + UNIQUE 위반 시 IntegrityError catch (동시 POST/이벤트 중복 호출에도 중복 INSERT 차단)
- **실기기 실측**: 해피바스 재방문 (같은 5,990원) → price_points 2행 유지 + point_count 3→5 증가 / 리멤버린 가격 변동 4,980→24,900 → 신규 로우 정상 캡처

## v0.5.0 (2026-08-03) — [extension] 연관 상품 자동 수집 (Phase 1)

- **상품 페이지 연관 상품 캡처**: 상품 페이지에서 "함께 비교하면 좋을 상품/비슷한 상품/이런 상품은 어때요" 등 연관 섹션의 상품 카드를 자동 수집해 카탈로그에 등록
  - 범용 추출기(`Extractor.extractRelated`): 특정 섹션명에 의존하지 않고 상품 링크 + 카드(이미지/이름/가격) 기반 — 몰 구조 변경에 견고
  - 가격이 노출되는 상품은 가격까지 저장 (`source=extension`), 가격 없는 상품은 카탈로그만 등록 (방문 시 가격 캡처)
  - **수집 시점 2단계**: ①페이지 로드 직후 1회 (현재 보이는 카드) ②사용자가 스크롤할 때 lazy 로딩으로 새로 로드된 카드만 재수집 (600ms 디바운스) — 자동 스크롤 금지
  - 중복 방지: content(relatedSentIds) + background(relatedUploadedIds) 이중 안전망, 1회 최대 10개
  - Phase 2(목록/검색 페이지), Phase 3(관계 그래프)는 예정

## v0.4.0 (2026-08-03) — [server] [extension] 가격 통계·추적자 수·방문 유도

- **서버 가격 통계 API 확장**: `GET /products/{id}` 응답에 `min_price`/`avg_price`/`price_count`/`watch_count` 추가 (전체 기록 기준 집계)
  - `watch_count` = 해당 상품을 추적 중인 기기 수 — "N명 추적" 지표
  - `GET /devices/{did}/watches` 응답에 `last_checked_at` 추가 (마지막 캡처 시각)
- **팝업 UI**: 현재 상품 섹션에 '역대 최저가'/'평균보다 저렴' 배지 + 평균·최저가·추적자 수 표시
- **플로팅 패널**: 가격 추이 패널에 동일 배지 추가 (서버 전체 통계 기준, 기간 필터와 별개)
- **브라우저 알림 강조**: 가격 하락 시 `가격 N% 내려갔습니다!` 타이틀 + `-N%` 할인율 표기
- **재방문 유도 (방문 캡처)**: 찜 목록(팝업/플로팅)에 3일 이상 미캡처 상품에 `확인 필요 · N일 전` 배지 — 클릭 시 상품 페이지 오픈 → 자동 캡처로 최신 가격 수집

## v0.3.1 (2026-08-03) — [extension] [server]

- **상품 페이지 플로팅 버튼 + 가격 추이 패널**: 상품 페이지 우하단 플로팅 버튼(하락 그래프 아이콘) → 클릭 시 해당 상품의 가격 추이 표시 (shadow DOM으로 페이지 스타일 격리)
  - 상품명 / 최근가 / 직전 대비 변동(▼▲) / 최저·최고가 / 이력 건수 / 캔버스 라인 그래프
  - 서버에서 실시간 조회 (`GET /products/{id}` + `/prices?limit=50`), 서버 다운 시 에러 안내 (E-EXT-NET-1001)
  - SPA 라우팅 대비 URL 변경 감시(2초 주기 location 비교)
- **공용 설정 통합**: `common.js`에 `SWB_CONFIG`(서버 주소 단일화) — background/popup/content 공유
- 기기ID 중복 발급 수정 + `init()` 중복 호출 제거 (기기 1개 고정 확인)

## v0.3.0 (2026-08-03) — [server] [extension] 전면 재구성

- **아키텍처 전환**: 맥 메뉴바 앱 폐기 → 중앙 서버 + 브라우저 익스텐션(Chrome MV3)
  - 맥 앱 코드 전체 제거 (git 히스토리로만 보존)
  - 수집 우선순위: ①서버 크롤러(올리브영 Playwright) ②익스텐션(전 몰) ③(폐기) 맥 메뉴바
- **결정 기록**: 크롤링 PoC 실측 결과 반영
  - 올리브영 서버 Playwright headless 성공 (403 우회, 가격+og 메타)
  - 네이버: 쿠키 없는 브라우저 전부 캡차 차단 / 쿠팡: Akamai Access Denied
  - → 네이버/쿠팡은 익스텐션이 유일한 자동 수집 채널
- docs 전면 재작성 (PRD/DESIGN/PLAN/TODO)

## v0.2.x (2026-08-02 ~ 08-03) — [macos] 레거시 (폐기)

- T-59 가격 변동 알림 3중 구조, 개발자 서명, 토스트 등 — v0.3.0에서 전면 폐기
