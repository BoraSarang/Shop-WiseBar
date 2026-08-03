# CHANGELOG — Shop WiseBar (똑바)

## [0.2.3] — 2026-08-03 [macos] — T-57 팝오버 2모드 재설계

### 추가
- 캐치 모드 (CapturedProductView): 브라우저 상품 페이지 감지 시 상품 정보 + 가격 추이 표시 — 기간 탭(7일/1개월/전체), 최저/최고/평균 통계, 현재 최저가 판정 배지, "최저가보다 X원 비싸요" 절약액, 추적 시작/찜됨 버튼 (참고: pricearchive.org / AiPrice / AliHelper)
- 홈 모드: 마지막에 본 상품 1개 (서버 조회, UserDefaults 영속) + "찜한 상품 보기 →" 진입 버튼
- 찜 목록 모드: 기존 상품 관리 화면 (뒤로 버튼 추가)
- ServerClient.getPriceHistory — 서버 가격 이력 → 차트 데이터 (서버 → 로컬 폴백)
- 브라우저에서 본 모든 상품의 lastViewedProductID 기록 — 서버 DB 데이터 축적 기반 (T-58 추천 리스트 대비)

### 수정
- 기존 "추적할까요?" 제안 배너 → 캐치 뷰의 "추적 시작" 버튼으로 흡수
- 캐치 콘텐츠 상단 정렬 (팝오버 중앙 배치 문제 해결)

### 검증 (실기기)
- 홈 모드: 마지막 본 상품 안내 + 찜 목록 진입 — PASS
- 캐치 모드: 비관심/관심 상품 모두 상품 정보 + 추이 표시 — PASS
- 관심 상품 자동 팝오버 + 캐치 뷰 — PASS (store:teststore:999999 watch 등록)

## [0.2.2] — 2026-08-02 [macos] — P2 완성: 쿠팡 옵션 고정 + 브라우저 모니터링

### 추가
- 브라우저 모니터링 (T-20/21): Chrome/Whale 활성 탭 3초 폴링 → 지원 상품 페이지 감지 → 팝오버 "추적할까요?" 제안 배너 (추적 시작/닫기)
- E-MAC-BROWSER-3002: 웨일(Whale) AppleScript JS 실행 미지원 안내 (실측: 설정 키 미지원)

### 수정
- 쿠팡 가격 안정화: 첫 옵션(.select-item) 클릭 후 추출 — 옵션 기본값에 따른 가격 변동 방지 (게이밍PC 2회 연속 1,029,000원 고정 검증)
- 브라우저 세션 몰별 병렬화: 직렬 17.3초 → 병렬 10.7초 (네이버 loadDelay 5초로 탭 경합 해소, 2회 연속 failed=0)
- 쿠팡 로드 딜레이 6초 + 로드 확인("쿠팡" 텍스트 검증) — 첫 로드 지연 대응
- 에러코드 분리: 웨일 미지원 시 E-MAC-BROWSER-3002 (기존 3001은 자동화 권한)

### 검증 (docs/tests/v0.2.1_macos.md)
- 전체 갱신 4상품 failed=0 (네이버2+쿠팡1+올리브영1), PERF 10.6~10.7초
- 브라우저 모니터링 실동작: Chrome 쿠팡 페이지 방문 시 감지 로그 + 제안 배너 (스크린샷 v0_3_p2_monitor_banner.png)

## [0.2.1] — 2026-08-02 [macos] — P2 브라우저 세션 수집 (네이버/쿠팡)

### 추가
- BrowserSessionFetcher: Chrome/Whale/Edge AppleScript 세션 실행 유틸 — 새 탭 → 로드 → JS(base64) → 탭 닫기, E-MAC-BROWSER-3001 에러 체계
- 네이버 브라우저 세션 수집: m. 모바일 페이지에서 "상품 가격" 다음 금액 추출 (데스크톱/모바일 4개 페이지 실측, 스마트스토어 3,529,000원 / 랄프로렌 239,000원 검증)
- 쿠팡 브라우저 세션 수집: "N%" 할인율 다음 줄 금액 패턴 (게이밍PC/숟가락 실측) — Akamai 우회
- 디버그 자동화 훅: `AutoOpenPopover`(시작 시 팝오버 오픈), `AutoAddURL`(URL 자동 등록) — #if DEBUG 전용

### 검증
- 네이버 2건 실기기: 스마트스토어(기존) + 랄프로렌 광고 URL 등록 → 브라우저 세션으로 가격 갱신/등록 성공 (failed=0)
- 쿠팡 실기기: vp/products/8791438857 등록 → 1,029,000원 수집 성공
- 쿠팡 옵션 상품은 로드 시점 기본 옵션에 따라 가격 변동 (게임용8번 1,029,000 vs 게임용11번 1,339,000) — 쿠팡 특성, 옵션 없는 상품은 안정적

### 수정
- NaverFetcher: HTTP 파서(429 차단) → 브라우저 세션 수집으로 교체, 카탈로그(c:)는 m.search.shopping.naver.com URL 구성
- CoupangFetcher: 스텁(E-MAC-BROWSER-3001 throw) → 브라우저 세션 수집 구현
- 전체 갱신 PERF: 네이버+올리브영 4.25s (브라우저 탭 로드 4초 포함, 15분 주기 내 허용)

## [0.2.0] — 2026-08-02 [macos] — P1 가격 추적 MVP

### 추가
- 몰 레지스트리 + URL 파서: 쿠팡/네이버(브랜드·스마트스토어·카탈로그)/올리브영(표준·oy.run 단축 URL)
- SwiftData 저장소: Product/PricePoint 모델, ProductStore(통계/중복 방지), SettingsStore(주기/알림/브라우저)
- PriceFetcher: 올리브영 HTTP 파싱(Next.js salePrice + og 태그), 네이버(HTML 파서), 쿠팡(P2 스텁)
- PriceFetchCoordinator: URL 등록 → 초기 수집 → 이력 기록 → 알림 트리거
- RefreshScheduler: 15분 주기 자동 갱신 + 앱 시작 즉시 1회 + 수동 갱신
- NotificationEngine: 가격 하락/목표가 도달 알림 (UNUserNotificationCenter)
- 팝오버 UI: 상품 카드(몰·가격·변동 배지·이미지), URL 등록 필드, 지금 갱신, 상세 펼침(가격 이력 차트 + 최고/최저/평균/목표가), 우클릭(열기/이력/목표가/삭제)
- 설정 창 실기능: 갱신 주기/알림 토글/브라우저 선택 (브라우저는 P2)
- 우클릭 메뉴 실기능: 찜한 상품 관리·지금 상품 추가·지금 갱신

### 검증 (docs/tests/v0.2.0_macos.md)
- 올리브영 실상품 통합 테스트: oy.run → goodsNo 해석 → 39,900원 수집 → 저장 → 자동 갱신 → 중복 방지 (PERF 366~707ms)
- 네이버 실측: HTTP 429(IP 차단, 쿠키 없는 요청만 차단) — 브라우저 접속은 정상 확인 → P2 브라우저 세션으로 전환
- 스크린샷: v0_2_p1_popover_product.png, v0_2_p1_popover_2cards.png

### 수정
- 네이버/올리브영 타임아웃 8/12초 + 캐시 무시 (네이버 응답 지연 시 전체 멈춤 방지)
- refreshAll 몰 간 병렬 처리 (순차 → 몰별 TaskGroup) — 네이버 1건 지연 시 전체 블로킹 해소 (366ms)
- 팝오버 표시 시 NSApp.activate + makeKey (LSUIElement 앱 키보드 포커스 누락 해결 — 자동화 검증 가능)
- 네이버/쿠팡 등록 실패 시 "몰명 상품 (가격 수집 대기)" 이름 저장 + P2 안내 메시지

### 참고
- 에러코드 추가: E-MAC-VALID-2003 (ID 형식 오류)
- 알림 권한: ad-hoc 서명 앱은 macOS 알림 거부 — 개발자 서명 후 재확인 (E-MAC-NET-1001 관련 아님)

## [0.1.0] — 2026-08-02 [macos]

### 추가
- 프로젝트 골격: xcodegen 기반 Xcode 프로젝트 (macOS 14+, NSStatusItem 메뉴바 앱)
- 메뉴바: 좌클릭 팝오버 / 우클릭 메뉴 (찜 관리·상품 추가·설정·Debug Panel·정보·종료)
- DebugLogger: 8레벨(ACTION/API→/API←/INFO/WARN/ERROR/SYSTEM/PERF) + `[PERF]`/`error_code`/`cost` 필드, maxLogs 5000
- DebugPanel: Cmd+D, NSWindow 재사용, 600×320 중앙, `.floating+100`, 자동 스크롤 📌, 색상 팔레트, 선택/전체 복사, 클리어
- 설정 창 골격 (SettingsWindow, P1~P2에서 실제 항목 채움)
- 빌드 표준: `build_and_run.sh` 디스패처 + `scripts/build-macos.sh`/`screenshot.sh`/`env-expiry-check.sh`
- 문서 세트: PRD/DESIGN/PLAN/TODO/CHANGELOG/AGENTS.local/AGENTS.macos/AI_MODELS.json/error_message_ko.json
- 보안: .env.example(+만료일 주석), gitleaks pre-hook, .gitignore

### 참고
- 에러코드 시드: E-MAC-NET-1001~1002, E-MAC-VALID-2001~2002, E-MAC-BROWSER-3001, E-MAC-DB-4001, E-MAC-GLIST-5001
- 쿠팡 수집 전략 확정: 브라우저 세션 활용 (Akamai 우회) — P2-T23

### 수정 (P0 실기기 자동화 테스트 — docs/tests/v0.1.0_macos.md TC-01~TC-11)
- AX 합성 클릭에서 `NSApp.currentEvent` nil로 early-return → 방어 처리 (접근성 호환) — E-MAC-UI-6001 관련
- DebugPanel 윈도우가 콘텐츠 최소 크기(400×272)로 축소 → `sizingOptions=[]`+`setContentSize(600×320)` 고정
- `DebugLogger.push()`의 print를 동기 출력으로 변경 (종료 직전 로그 유실 방지)
