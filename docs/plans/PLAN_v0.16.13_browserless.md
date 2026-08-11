# PLAN v0.16.13_server — Browserless 연동 (크롤러 브라우저 클라우드 이전)

- **버전**: v0.16.13 / PLATFORM: server
- **작성일**: 2026-08-11
- **목적**: Render 512MB 컨테이너 안에서 Playwright Chrome(+System Chrome)이 메모리를 압박해
  `/health` 30초 지연·재시작 루프를 일으키던 근본 구조 문제를, **브라우저를 Browserless 클라우드로 이전**해 해결한다.

---

## 1. 개요

| 항목 | 현재 | 이후 |
|------|------|------|
| 브라우저 실행 위치 | Render 컨테이너 내부 (Playwright 번들 Chromium / 로컬 시스템 Chrome) | **Browserless 클라우드** (`production-sfo.browserless.io`) |
| 크롤러 코드 | `crawlers/_browser.py`의 `pw.chromium.launch(...)` | `pw.chromium.connect_over_cdp(...)` or `connect(...)` 로 재포인트 |
| Chrome 메모리 부담 | 컨테이너 512MB 공유 (근본 문제) | **컨테이너에서 완전 제거** → `/health` 항상 빠름 |
| 배치 동작 | 컨테이너 내 worker (enabled=false 정지됨) | web 컨테이너 uvicorn + worker 동시 실행 가능 (sleep 문제만 확인) |

## 2. 결정 사항

1. **접근 경로 (Browserless Setup Assistant Step 2 기준)**: 사용자는 **기존 Python Playwright 크롤러 코드**를 갖고 있으므로
   **Path D (Edge Case — 기존 코드 재포인팅)** 을 선택. 새 SDK 도입(BAP)이나 재작성이 아니라
   `launch()` → `connect_over_cdp()` 로의 최소 변경.
2. **연결 방식**: `pw.chromium.connect_over_cdp(wsEndpoint)` 사용.
   - `connect()`(Playwright 프로토콜)보다 CDP 방식이 stealth/ad-blocking 등 Browserless 헬퍼와 호환,
   - 컨텍스트 오버라이드(`new_context`)는 CDP 브라우저에서 `browser.contexts[0]` 기반으로 동작하도록 보완 필요.
3. **시크릿**: Browserless token은 `.env`의 `BROWSERLESS_TOKEN` (gitignore). **커밋 금지**, 소스 코드에는 참조만 (환경변수 주입).
   값은 본 문서·로그·스크린샷에 절대 기재하지 않는다 (Setup Assistant 규칙).
4. **모드**: `BROWSERLESS_TOKEN`이 설정되면 Browserless 연결, 없으면 기존 로컬 launch 폴백 유지 (롤백 안전).
5. **배포 적용**: Render web / worker 컨테이너에도 `.env` 원리 대신 Render 대시보드 `Environment`에
   `BROWSERLESS_TOKEN` 추가 (git에 미노출). 공유 클라우드 배포이므로 Dockerfile 변경 불필요.

## 3. 아키텍처 (변경 후 요청 흐름)

```
[Render 컨테이너]                    [Browserless 공유 클라우드]
uvicorn + worker                      production-sfo.browserless.io
   │  크롤러 배치 시작                     │
   ├── playwright → connect_over_cdp ────► Chrome 헤드리스 (512MB 압박 없음)
   │   (code only, browser 미실행)        │  stealth/ad-block/BQL 부가 기능 옵션
   └── /health ──► 즉시 응답 (메모리 여유)
```

- Playwright 라이브러리는 클라이언트 코드로만 존재 → PyPI 패키지만 있으면 됨 (chromium 바이너리 불필요).
- 결과적으로 Dockerfile의 `playwright install chrome/chromium` 단계도 제거 가능하나, 폴백 유지 차원에서 우선 잔류.

## 4. 구현 단계

| T-no | 작업 | 설명 |
|------|------|------|
| T-124a | `.env`(`server/`, gitignore)에 `BROWSERLESS_TOKEN=...` + `.env.example`에 키만 추가(값 없음) | 시크릿 규칙 준수 |
| T-124b | `crawlers/_browser.py`: `get_browser()`에 Browserless 연결 분기 추가 | `connect_over_cdp(ws)` + 컨텍스트 보완 + 실패 시 기존 launch 폴백 |
| T-124c | `crawlers/_browser.py`: `new_context()` — CDP 브라우저에선 `browser.contexts[0]` 재사용 + route 차단 유지 | 컨텍스트 오버라이드 보완 |
| T-124d | 로컬 1회 검증: `BROWSERLESS_TOKEN` 설정 + `python -m crawlers.worker --once` | oliveyoung/naver 수집 성공 확인 |
| T-124e | Render 대시보드: web/worker 두 서비스 `Environment`에 `BROWSERLESS_TOKEN` 추가 안내 | git 무노출 |
| T-124f | 문서 갱신: CHANGELOG(v0.16.13)·PLAN·TODO·ENDPOINTS·session 로그 | - |

## 5. 테스트 계획 (TC)

| TC | 시나리오 | 통과 기준 |
|----|----------|-----------|
| TC-0.16.13-1 | 로컬 `--once` (Browserless 연결) | oliveyoung ≥1건 수집 · naver 정상 · Chrome 미실행 확인(로그) |
| TC-0.16.13-2 | `BROWSERLESS_TOKEN` 미설정 폴백 | 기존 로컬 launch로 동작 (회귀 없음) |
| TC-0.16.13-3 | Render 배포 후 `/health` | 200 OK < 1초 (배치 중에도 지연 없음) |

## 6. 롤백 계획

- 소스: `git revert`로 `_browser.py` 원복 → 로컬 launch로 복귀.
- 배포: Render 환경변수에서 `BROWSERLESS_TOKEN` 제거 → 폴백 경로 자동 활성.
- 계정: Browserless 대시보드에서 전체 세션 확인 후 실패 세션 수동 종료 방법 안내.
- 부수: Dockerfile의 playwright install 재실행은 `.env` 삭제 없이 무해.

## 7. 성능 예산

| 지표 | 현재(컨테이너 Chrome) | Browserless |
|------|----------------------|-------------|
| 배치 크롤링 시 `/health` | 11.4~31.0초 지연 (운영 실측) | **< 1초 유지 (웹 격리)** |
| 컨테이너 메모리 | 512MB 근접 (OOM/재기동) | Chrome 제거 → 여유 |
| 왕복 네트워크 | - | SFO 리전, ~수백 ms (1회/시간 배치라 영향 미미) |

## 8. 에러 코드

- 기존 `E-SRV-NET-1001` 계열 재사용. 신규 코드 없음 (proxy/연결 실패는 기존 폴백 경로로 흡수).

## 9. 권한 / 보안

- Browserless token은 커밋·로그·스크린샷에 **절대 노출 금지** (Setup Assistant 규칙).
- MCP 클라이언트 설정 파일(`.cursor/mcp.json`, `.vscode/mcp.json`)로 확장할 경우
  **gitignore 확인 후** 진행 — 현재는 직접 커밋 대상에 포함하지 않음.
- token 로테이션: 만료/침수 시 대시보드에서 재발급 → `.env` 갱신만으로 반영.