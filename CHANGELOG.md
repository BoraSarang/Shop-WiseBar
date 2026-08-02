# CHANGELOG — Shop WiseBar (똑바)

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
