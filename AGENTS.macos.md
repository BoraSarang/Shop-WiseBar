# AGENTS.macos.md — macOS 전용 규칙

상위 규칙: `AGENTS.md`(공통) → `AGENTS.local.md`(프로젝트).

## 프로젝트 정보

| 항목 | 값 |
|------|-----|
| Xcode 프로젝트 | `ShopWiseBar.xcodeproj` (xcodegen 생성 — 소스는 `project.yml`) |
| Scheme | `ShopWiseBar` (Debug/Release) |
| 번들 ID | `com.borasarang.ShopWiseBar` |
| 배포 위치 | `~/Applications/ShopWiseBar.app` |
| 서명 | 개발: ad-hoc (`-`), 배포 시 Developer ID + Hardened Runtime 재검토 |
| 샌드박스 | 개발 단계 비샌드박스 (자동화 권한 TCC 직접 처리) |
| LSUIElement | `YES` (Dock 아이콘 없는 메뉴바 앱) |
| 최소 OS | macOS 14.0 (Xcode 26, Swift 5 언어 모드) |

## 권한 (TCC)

- `NSAppleEventsUsageDescription` 설정됨 — 브라우저 자동화 권한 (P2 BrowserMonitor)
- 첫 사용 시 시스템 팝업 1회 → 거부 시 `E-MAC-BROWSER-3001` 안내
- Accessibility 권한은 웨일 폴백 시에만 사용 (P2-T22)

## GBridge 모듈

- 현재 등록 모듈 없음 (브라우저/클립보드 연동은 네이티브 구현)
- 신규 브릿지 추가 시 본 파일에 등록 필수

## 디버그 표준 (AGENTS.md 19장 준수)

- 메뉴바 앱이므로 Debug Panel은 우클릭 메뉴 `Debug Panel` 항목 + 전역 `Cmd+D` (로컬 키 모니터)
- 로그 레벨 8종, maxLogs 5000, NSWindow 재사용, 600×320 중앙, `.floating+100`, NSTextView 금지
- release: `#if DEBUG` 컴파일 타임 완전 제거

## 성능 예산

| 지표 | 예산 |
|------|------|
| Cold Start | ≤ 1.5s |
| 메모리 (debug) | ≤ 300MB |
| 프레임 | 60fps |
| 브라우저 폴링 | 2~5초 (설정) |

## 빌드 실패 시 3단계

1. `xcodegen generate` 재실행 (project.yml 누락 확인)
2. `./build_and_run.sh debug macos clean` (파생 데이터 초기화)
3. `.derivedData` 로그 확인 → DebugPanel이 아닌 xcodebuild 로그 우선
