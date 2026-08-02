# DESIGN — Shop WiseBar (똑바)

- **버전**: v0.1.0 · **플랫폼**: macOS · **작성일**: 2026-08-02

## 1. 개요

SwiftUI + AppKit 하이브리드, `NSStatusItem` 기반 메뉴바 앱. 최소 macOS 14.
개발 단계는 비샌드박스 + ad-hoc 서명, 배포 시 Developer ID/샌드박스 재검토.

## 2. 아키텍처

```
MenuBarController (NSStatusItem)          ← 좌클릭 팝오버 / 우클릭 NSMenu
├── BrowserMonitor    (P2, AppleScript 폴링)  ← 우선순위 1: 탭 URL 감지 → 몰 판별 → 추적 제안
├── ClipboardMonitor  (P3, NSPasteboard 폴링) ← 우선순위 2: 공유 URL 감지
├── MallRegistry + MallParser (프로토콜 기반, 몰별 구현)
│   ├── CoupangParser  (쿠팡: vp/products/{id}, link.coupang.com 리디렉션)
│   ├── NaverParser    (스마트스토어 /products/{id}, 쇼핑 /catalog/{id})
│   └── OliveYoungParser
├── PriceFetcher + PriceScheduler  ← 백그라운드 갱신 (간격 설정)
│   ├── HTTP 경로: URLSession + HTML 파싱 (네이버/올리브영)
│   └── 브라우저 경로: Chrome execute javascript (쿠팡, Akamai 우회)
├── PriceHistoryStore (SwiftData)     ← 상품/가격 이력/설정
├── NotificationEngine (UNUserNotificationCenter) ← 최저가/목표가 알림
├── PriceStats + Swift Charts         ← 최저/최고/평균/변동률
└── SettingsView                      ← 브라우저 선택/갱신 주기/알림 조건
```

## 3. 플랫폼 결정 사항

| 항목 | 결정 | 사유 |
|------|------|------|
| 메뉴바 | `NSStatusItem` (MenuBarExtra 미사용) | 좌클릭=팝오버 / 우클릭=메뉴 구분 필요 (MenuBarExtra는 불가) |
| 저장소 | SwiftData (macOS 14+) | 상품/가격 이력/설정 통합 |
| 그래프 | Swift Charts | 1순위 네이티브 차트 |
| 알림 | UNUserNotificationCenter | 로컬 알림 |
| 브라우저 연동 | NSAppleScript 폴링 (2~5초) | 확장 프로그램 불필요, TCC 자동화 권한 |
| 쿠팡 수집 | Chrome `execute javascript` (페이지 내 가격 추출) | Akamai Bot Manager 우회, 로그인 세션 반영 |
| 기타 몰 수집 | URLSession + 몰별 HTML 파서 | 쿠팡 제외 몰은 직접 수집 가능 |
| 디버그 | DebugLogger 8레벨 + DebugPanel (Cmd+D) | AGENTS.md 19장 준수, release 제거 |

## 4. 모듈 구성 (로드맵)

| 모듈 | 파일(예정) | 페이즈 |
|------|-----------|--------|
| 앱 진입점 | `ShopWiseBar/App/ShopWiseBarApp.swift` | P0 |
| 메뉴바 | `ShopWiseBar/MenuBar/MenuBarController.swift` | P0 |
| 디버그 | `ShopWiseBar/Debug/DebugLogger.swift`, `DebugPanelWindow.swift`, `DebugPanelView.swift` | P0 |
| 저장소 | `ShopWiseBar/Store/*` (Product, PricePoint, Settings) | P1 |
| 몰 연동 | `ShopWiseBar/Mall/*` (MallRegistry, MallParser 프로토콜) | P1 |
| 수집 | `ShopWiseBar/Collector/*` (PriceFetcher, PriceScheduler) | P1 |
| 브라우저 | `ShopWiseBar/Browser/*` (BrowserMonitor, BrowserSession) | P2 |
| 클립보드 | `ShopWiseBar/Clipboard/ClipboardMonitor.swift` | P3 |

## 5. 에러 체계

- 형식: `E-MAC-{CATEGORY}-NNNN` (CATEGORY: NET, VALID, BROWSER, DB, GLIST, BRIDGE, PERF, UI)
- 모든 throw/실패는 `AppError(code, debugMessage, cause)` 래핑
- 사용자 노출 메시지는 `error_message_ko.json`에만 정의, DebugLogger에는 `error_code` 포함

## 6. 성능 예산

| 지표 | 예산 |
|------|------|
| Cold Start | ≤ 1.5s |
| 메모리 (debug) | ≤ 300MB |
| 프레임 | 60fps (16ms) |
| 브라우저 폴링 | 2~5초 (설정), 권한 실패 시 WARN |
| 가격 갱신 | 몰당 1회/15분 기본 (설정 가능), 중복 요청 금지 |

## 7. 보안

- 시크릿 하드코딩 금지 → `.env.example` + Keychain, `env-expiry-check.sh` 검증
- `gitleaks detect --no-git` pre-hook (build_and_run.sh 내장)
- DebugPanel은 `#if DEBUG`로 release에서 컴파일 타임 완전 제거
- 사용자 쿠키/세션은 앱 내부에서만 사용, 외부 전송 금지

## 8. 테스트 계획 (요약)

- `docs/tests/v{버전}_macos.md` 기록: 빌드 → DebugPanel 로그 → PERF → 스크린샷
- 네트워크 장애: 비행기 모드/오프라인에서 캐시 폴백 검증 (P1)
- 브라우저 권한 거부 시 우아한 폴백 (P2)
