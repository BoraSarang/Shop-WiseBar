# 세션 로그 — 2026-08-02 (macos) — P0 프로젝트 골격

## 1. 무엇을 했나
- Shop WiseBar(똑바) P0 완료: 문서 세트(PRD/DESIGN/PLAN/TODO/CHANGELOG/AGENTS.local/AGENTS.macos/AI_MODELS.json/error_message_ko.json/.env.example/PR 템플릿), 빌드 표준(build_and_run.sh 디스패처 + scripts/build-macos.sh·screenshot.sh·env-expiry-check.sh), Xcode 프로젝트(xcodegen, project.yml 소스) + 메뉴바 골격(NSStatusItem 좌클릭 팝오버/우클릭 메뉴), DebugLogger 8레벨 + DebugPanel(Cmd+D, 600×320, .floating+100), SettingsWindow 골격, git init

## 2. 플랫폼
- macOS 전용 (최소 macOS 14, 번들 com.borasarang.ShopWiseBar, LSUIElement)

## 3. 빌드 결과
- `./build_and_run.sh debug macos` 성공 (gitleaks 통과, env-expiry-check 통과, 경고 0)
- 배포: ~/Applications/ShopWiseBar.app, 프로세스 실행 확인(pid 22868)
- 참고: bash 3.2 + `set -u` 빈 배열 오류 → `${arr[@]+"${arr[@]}"}` 관용구로 수정 완료

### 3.1 직접 테스트 (docs/tests/v0.1.0_macos.md, TC-01~TC-11)
- 자동화(AppleScript/AX/CGEvent) + CGWindowList 실측 + stdout 캡처(script PTY)로 검증
- TC-01~TC-10 PASS: 실행/로그포맷/팝오버(layer 25)/컨텍스트메뉴(layer 101)/설정창/디버그패널 열기·닫기(layer 103=floating+100)/종료/Release 제거(DebugPanelView 심볼 0)
- TC-11(Cmd+D): 자동화 제약으로 수동 확인 필요 (앱 활성 불가 — LSUIElement)
- 발견·수정 3건: ①`NSApp.currentEvent` nil 방어 ②DebugPanel 크기 600×320 고정(sizingOptions+setContentSize) ③`print` 동기 출력(종료 로그 유실 방지)
- 테스트 툴링 노트: System Events 메뉴 클릭은 오픈 직후 즉시 시도해야 성공(지연 시 -1719 플레이크, 앱 버그 아님)

## 4. PERF 결과
- P0는 빈 골격이라 성능 측정 생략 (P1부터 [PERF] cold_start 로깅 예정)
- 메모리 예산 300MB / Cold Start 1.5s 기준 문서화 완료

## 5. 남은 TODO
- P1: 상품 모델+SwiftData(T-10), 몰 레지스트리+URL 파서(T-11), PriceFetcher(T-12), 스케줄러(T-13), 알림(T-14), 통계+그래프(T-15), 팝오버 UI(T-16), 우클릭 실제 기능(T-17)
- P2: BrowserMonitor(T-20~23) — 웨일 AppleScript 실측(T-22) 중요
- 최초 커밋 미완료 (사용자 확인 대기)

## 6. 다음 에이전트 전달
- project.yml을 소스로 xcodegen generate 필수 (build-macos.sh가 자동 수행)
- 에러코드 시드: E-MAC-NET-1001/1002, E-MAC-VALID-2001/2002, E-MAC-BROWSER-3001, E-MAC-DB-4001, E-MAC-GLIST-5001 (error_message_ko.json 동기화 필수)
- 쿠팡은 직접 HTTP 금지 → 브라우저 세션(execute javascript) 원칙 확정
- DebugPanel 열림 검증 방법: Cmd+D (로컬 키 모니터) 또는 우클릭 메뉴 — 스크린샷은 docs/screenshots/macos/v0_1_after_build.png
