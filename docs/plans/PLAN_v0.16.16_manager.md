# PLAN v0.16.16 — 매니저 로컬 배치 실행기 + 인사이트 리스트/그리드 + AI 보류 (T-127)

> 작성: 2026-08-14 · 플랫폼: [server][macos] · 버전: v0.16.16 · 상위: T-127
> 이전: `PLAN_v0.16.15_manager.md` (v0.16.15, T-126 완료)

## 1. 개요

똑바 매니저(macOS)를 단순 조회 뷰어에서 **로컬 수집 오케스트레이터**로 확장한다.

사용자 결정 (2026-08-14):
1. **로컬 배치는 수동 실행/종료** — 매니저가 `Process`로 `run-local-crawler.sh`를 직접 제어 (launchd 사용 안 함)
2. **매니저 앱 로그인 시 자동 실행은 설정 토글** — macOS 로그인 항목(SMAppService)으로 등록/해제
3. **AI 도입은 보류** — AI_MODELS.json에 결정 기록하고 관리자 기능부터 진행

### 범위 요약

| 항목 | 서버 | macOS | 로컬 크롤러 |
|------|------|-------|-------------|
| 수집 대상 페이지 등록/조회 | `GET/POST /admin/crawl/targets` | 로컬 배치 섹션 | worker가 target 파싱 |
| 인사이트 상품 리스트/그리드 | `/admin/insight` 메타 조인 | InsightView 개편 | — |
| 로그인 자동 실행 설정 | — | SettingsView (SMAppService) | — |
| 로컬 배치 수동 제어 | — | 로컬 배치 섹션 (Process) | — |
| AI 보류 문서화 | — | — | — |

## 2. 결정 사항

| # | 결정 | 근거 |
|---|------|------|
| D1 | 로컬 배치 = 매니저가 `Process` 직접 실행/종료 | 사용자 선택 1번. "했다 말았다" 최적, 매니저 열 때만 동작 |
| D2 | 로그인 자동 실행 = 앱 토글, 배치는 항상 수동 | 사용자 선택 2번. SMAppService.mainApp (macOS 14 대응) |
| D3 | AI 도입 보류 | 사용자 결정. LLM 미사용 유지, AI_MODELS.json note 갱신 |
| D4 | 수집 대상 = 프리셋(네이버 메인/올리브영 랭킹) + 커스텀 URL | 실측 기반: 네이버 캡차 리스크·쿠팡 Akamai 차단. 실패 시 명확 에러 |
| D5 | 인사이트 메타 조인은 products_top 패턴 재사용 | name_normalizer/몰 매핑 기존 로직 활용 |

## 3. 아키텍처

### 3.1 서버 — 수집 대상 페이지

```
CrawlTarget (신규 모델, 추가 테이블)
  id           int PK autoincrement
  mall         str          — "naver" | "oliveyoung" | "custom"
  label        str          — 사용자 표시 이름 (예: "네이버 메인")
  url          str          — 목록 페이지 URL
  enabled      bool default true
  created_at   datetime
```

- `GET /admin/crawl/targets` → `{targets: [...]}` — enabled 순 정렬
- `POST /admin/crawl/targets` → body `{mall, label, url, enabled?}` → 생성 후 목록 반환
- `DELETE /admin/crawl/targets/{id}` → 204 idempotent
- 검증: `mall ∈ {naver, oliveyoung, custom}`, `url`은 http(s) 필수 (422), 중복 URL 금지 (409)

### 3.2 로컬 크롤러 — 목록 페이지 파싱

`crawlers/worker.py` 확장 (또는 신규 `crawlers/targets.py`):
- 시그니처: `run_targets_once() -> dict` — enabled target 순회
- 각 target:
  - `new_context` 로 목록 페이지 로드 (실측 채널/UA 재사용)
  - **네이버 메인** (`naver.com`): 메인 카드 링크에서 `상품 URL` 추출 — 캡차 발생 시 에러 사유 기록
  - **올리브영 랭킹** (`oliveyoung.com`): 랭킹/베스트 카드에서 goodsNo(13자 `[AB]\d{12}`) 추출
  - **custom**: 도메인 기반 몰 감지, 안 되면 일반 링크 추출
- 추출된 상품 → `Product` upsert (있으면 가격만 갱신, 없으면 신규 등록 — 기존 `_apply_price`/`upsert_batch` 로직 재사용)
- 결과는 `crawler_runs`에 `trigger="target"`로 기록

### 3.3 macOS — 로컬 배치 섹션 + 설정

- **LocalBatchView (신규 또는 CrawlerView 내 분기)**:
  - 상태: `LocalBatchState { stopped, running, error }` + 마지막 종료 시각
  - 시작 → `Process` 실행 `run-local-crawler.sh` (상시 루프)
  - 1회 → `run-local-crawler.sh --once`
  - 중지 → `process.terminate()`
  - 로그 → `/tmp/shopwisebar-crawler.log` tail 30줄 (파일 워치)
- **SettingsView (신규)**: 로그인 자동 실행 토글 (`SMAppService.mainApp.status`/`register`/`unregister`) + 서버 오버라이드 텍스트필드 (기존 `serverOverride`)
- **InsightView 개편**: 상품 카드(이미지+이름+가격+몰) 그리드/리스트 토글

## 4. 구현 단계

- [x] T-127a 문서 (본 문서)
- [ ] T-127b 서버 crawl/targets + 테스트
- [ ] T-127c 서버 insight 메타 조인 + 테스트
- [ ] T-127d 로컬 크롤러 목록 파싱
- [ ] T-127e SettingsView
- [ ] T-127f 로컬 배치 섹션
- [ ] T-127g InsightView 개편
- [ ] T-127h 검증·배포

## 5. 테스트 계획

| TC | 시나리오 | 기대 |
|----|----------|------|
| TC-127-1 | POST /admin/crawl/targets 정상/잘못된 mall·URL/중복 | 200/422/409 |
| TC-127-2 | GET /admin/crawl/targets 목록 정렬 | enabled 먼저 |
| TC-127-3 | DELETE /admin/crawl/targets/{id} | 204 idempotent |
| TC-127-4 | /admin/insight 메타 포함 여부 | name/image/url/mall non-null |
| TC-127-5 | 로컬 크롤러 --once target 실행 (올리브영 랭킹 실측) | 신규 등록 or 기존 갱신, crawler_runs 기록 |
| TC-127-6 | macOS LocalBatch 시작→중지→로그 | 프로세스 상태 전환 + 로그 tail |
| TC-127-7 | SettingsView 토글 | SMAppService 등록/해제 반영 |

## 6. 성능 예산

- 서버: crawl/targets 응답 < 300ms, insight 메타 조인 N+1 금지 (단일 조인)
- 로컬 크롤러: target 1개당 목록 파싱 ≤ 30s, 실패 시 에러 기록 후 다음 진행

## 7. 롤백 계획

- 서버: 엔드포인트 추가만이라 `git revert`로 즉시 복구
- 로컬 크롤러: 매니저 중지 버튼 = `process.terminate()` → kill 안 되면 `SIGKILL` 폴백
- SMAppService: 토글 off = `unregister()`
- macOS: 이전 빌드(`~/Applications` 백업)로 재복사

## 8. 에러코드 목록

| 코드 | 메시지 (error_message_ko.json) |
|------|-------------------------------|
| E-SRV-STOR-1001 | 수집 대상 등록에 실패했습니다. (새) |
| E-SRV-STOR-1002 | 이미 등록된 수집 대상입니다. (새) |
| E-MAC-PROC-1001 | 로컬 크롤러를 실행하지 못했습니다. (새) |

## 9. 권한/문서

- macOS: SMAppService는 권한 추가 없음 (Login Items 자동). hardened runtime 영향 없음 (Process는 동일 사용자)
- 서버: 관리자 전용 (기존 /admin/* 동일)
- 문서: ENDPOINTS.md (crawl/targets, insight 메타), TODO, CHANGELOG