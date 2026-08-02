# AGENTS.local.md — Shop WiseBar (똑바)

프로젝트 공통 특화 규칙. 상위 규칙은 `~/.config/opencode/AGENTS.md`(v1.9.0-common) 참조.

## 프로젝트 개요

- **앱 이름**: ShopWiseBar (영문) / 똑바 (한글) — 가격 변동 추적 메뉴바 앱
- **플랫폼**: macOS 전용 (P0~P3), 네이티브 SwiftUI + AppKit
- **최소 OS**: macOS 14 (Sonoma) · **번들 ID**: `com.borasarang.ShopWiseBar` (변경 시 본 파일 갱신)
- **벤치마크**: 폴센트(fallcent.com) — 가격 변동 추적 + 알림 + 통계

## 빌드/실행 (필수)

```bash
./build_and_run.sh debug macos        # 표준 빌드+실행 (gitleaks + env-expiry-check pre-hook)
./build_and_run.sh debug macos clean  # 클린 빌드
./scripts/screenshot.sh macos         # 스크린샷 (docs/screenshots/macos/)
```

- 배포 위치: `~/Applications/ShopWiseBar.app` (기존 앱 강제 종료 후 교체)
- Xcode 프로젝트는 **project.yml(xcodegen)이 소스** — `project.yml` 수정 후 반드시 `xcodegen generate`
- 직접 `xcodebuild` 금지 — 반드시 build_and_run.sh 경유

## 검증 워크플로우

1. 코드 수정 → 2. `./build_and_run.sh debug macos` → 3. DebugPanel(Cmd+D) 로그 확인 → 4. `[PERF]` 확인 → 5. 스크린샷 → 6. DoD 체크 → 7. `bd close` (사용 시)

## 규칙 요약

- 모델 고정: `docs/AI_MODELS.json` 준수 (유료 모델 사용 시 DebugLogger에 `cost` 로깅 필수)
- 에러: `E-MAC-{CAT}-NNNN` 코드 필수, 사용자 메시지는 `error_message_ko.json`에만
- 몰/수집기: `MallParser` 프로토콜 분리 원칙 (HTML 구조 변경 시 해당 몰 파서만 수정)
- 쿠팡: 직접 HTTP 수집 금지 — 브라우저 세션 활용 (`execute javascript`) 원칙
- 로그: `DebugLogger` 경유 필수 (`print()` 직접 사용 금지)
- 시크릿: 하드코딩 금지, `.env`/Keychain, `env-expiry-check.sh` 준수
- 크로스플랫폼 프레임워크(Flutter/KMP/RN) 추가 금지 — 네이티브 원칙
- 커밋: `type(macos): subject` 예) `feat(macos): add browser monitor`

## 참고 문서

- 기능 정의: `docs/PRD.md` / 기술 설계: `docs/DESIGN.md` / 로드맵: `docs/PLAN.md` / 작업 추적: `docs/TODO.md`
- 플랫폼 상세: `AGENTS.macos.md`
