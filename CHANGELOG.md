# CHANGELOG — Shop WiseBar (똑바)

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
