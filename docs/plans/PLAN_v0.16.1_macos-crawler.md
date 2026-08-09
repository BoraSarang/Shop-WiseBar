# PLAN v0.16.1 — macOS 똑바 매니저 크롤러 제어/모니터링 화면 (T-118)

> 문서 우선 원칙: v0.16.0(T-117)의 서버 크롤러 제어 API를 macOS 매니저 UI로 노출
> 작성: 2026-08-10 / 상태: 🔵 진행 / 버전: v0.16.1 (다음 릴리즈)

## 개요
v0.16.0에서 서버에만 구현된 크롤러 제어 API(`GET/PUT /admin/crawler/config`, `POST /admin/crawler/run`, `GET /admin/crawler/logs`)를
macOS 똑바 매니저 앱의 새 사이드바 섹션 "크롤러"로 연결한다. 설정(주기/활성화) 변경, 즉시 수집 트리거, 배치 실행 이력 조회를 화면에서 수행한다.

## 결정 사항
1. **섹션 추가**: `AppModel.Section`에 `crawler = "크롤러"` 추가 (시스템 이미지 `gearshape.2`). 사이드바 아이콘/배치 기존 5개 뒤.
2. **APIClient 확장**: `CrawlerConfig`/`CrawlerLog` 모델 + 4개 메서드(`crawlerConfig`, `updateCrawlerConfig`, `requestCrawl`, `crawlerLogs`).
   - `PUT` 메서드 필요 — 기존 `get` 헬퍼는 GET만 존재, `put` 헬퍼 추가.
3. **CrawlerView 신규**: 
   - 설정 카드 — 주기 드롭다운(1/3/6/12/24시간) + 활성화 토글 + "지금 수집" 버튼(확인 후 POST)
   - 실행 이력 카드 — 몰 배지 + 성공/실패 + 건수 + 소요시간 + 트리거 + KST 시각, 최근 50건
4. **주기 값**: 서버 `CRAWLER_INTERVAL_CHOICES = {3600,10800,21600,43200,86400}`와 동일한 5개.
5. **버전**: `project.yml` MARKETING_VERSION 0.15.0 → 0.16.1. 사이드바 하단 하드코딩 `똑바 매니저 · v0.15.0` → 동적(`Bundle.main`).
6. 실패 피드백: 에러 시 인라인 배너(기존 뷰 패턴과 동일, `AlertBadge`/빨간 텍스트).

## 아키텍처
- `macos/ShopWiseBarManager/features/CrawlerView.swift` 신규
- `macos/ShopWiseBarManager/APIClient.swift` — 모델 + put 헬퍼 + 크롤러 메서드
- `macos/ShopWiseBarManager/AppModel.swift` — Section + `crawlerConfig`/`crawlerLogs` 상태 + `refreshCrawler()` / 제어 메서드
- `macos/ShopWiseBarManager/features/App.swift` — Section 스위치 + 사이드바 (동적 버전)

## 구현 단계
- [ ] **T-118a** APIClient: `CrawlerConfig`/`CrawlerLog`/`CrawlerLogsResponse` 모델 + `put` 헬퍼 + 메서드 4종
- [ ] **T-118b** AppModel: `Section.crawler` + 상태(설정/이력) + `refreshCrawler()` + 컨트롤 액션(setInterval/toggleEnabled/requestRun)
- [ ] **T-118c** App: 사이드바/콘텐츠 스위치에 crawler 연결 + 하단 버전 동적 표시
- [ ] **T-118d** CrawlerView: 설정 카드(주기/활성화/지금수집) + 이력 리스트(성공·실패 배지, 트리거, KST)
- [ ] **T-118e** 검증: xcodebuild 성공 + 실제 실행에서 localhost 서버 연동(설정 조회·주기 변경·수집 요청·이력) 확인
- [ ] **T-118f** 문서: CHANGELOG v0.16.1 / TODO 반영 / 커밋·push

## 성능 예산
- 크롤러 화면은 API 2회(GET config + GET logs)만 호출 — 추가 부하 없음. 새로고침 시 병렬.

## 롤백 계획
- `git revert` 후 xcodebuild 복구. 서버 변경 없음(기존 API 재사용) — 안전.

## 관련 문서
- 서버 API: `docs/api/ENDPOINTS.md` `/admin/crawler` 4종 (v0.16.0)
- 계획: `docs/plans/PLAN_v0.16.0_naver-crawler.md` (T-117)

---

# v0.16.2 — 크롤러 성공/실패 통계 추가 (T-119)

> v0.16.1 실제 사용(2026-08-10): 운영 서버에서 크롤러 이력 count=0으로만 보임 (시도 수 미기록). "몇 건 시도 → 몇 건 성공, 몇 건 실패" 표시 요구.

## 결정 사항
1. **`crawler_runs.attempted` (시도 수) 컬럼 추가** — 실패 수 = `attempted - count`(성공)로 서버 응답에서 계산.
2. **크롤러 `run_once()` 반환값 변경**: `int`(성공) → `tuple[int, int]` `(attempted, success)`.
   - oliveyoung: 후보 중 `oyrun:` 제외 + 실제 fetch 시도한 수 = attempted
   - naver: URL 필터(`brand.naver.com`) 통과 후 fetch 시도한 수 = attempted
   - fetch 실패(None)나 저장 실패는 success에 미포함 → failed로 집계
3. **admin `/logs` 응답 확장**: 행에 `attempted`, `failed` 추가 (`failed = attempted - count`)
4. **macOS 표시**: 실행 이력 행 → "대상 N건 중 성공 M건 · 실패 K건" (기존 "N건 수집" 대체). 색상: success 초록 / failed > 0 빨강.
5. **마이그레이션**: `_ensure_columns`에 SQLite ALTER + PG `ADD COLUMN IF NOT EXISTS`.

## 구현 단계
- [ ] **T-119a** 서버: `models.py` CrawlerRun.attempted + `main.py` _ensure_columns 마이그레이션
- [ ] **T-119b** 서버: oliveyoung/naver `run_once` → `(attempted, success)` 반환
- [ ] **T-119c** 서버: worker.py attempted 기록 + admin.py logs 응답 attempted/failed
- [ ] **T-119d** macOS: CrawlerLog.attempted + CrawlerView 행 표시 "대상 N건 중 성공 M · 실패 K"
- [ ] **T-119e** 검증: pytest(기존 + attempted) + xcodebuild + 운영 로컬 DB 실측
- [ ] **T-119f** 문서: CHANGELOG v0.16.2 / TODO / ENDPOINTS + 커밋·push

## 롤백 계획
- `git revert` — 서버 컬럼 추가는 무해(기본값 없으면 0으로 취급, 로직에서 `getattr` 방어 불필요: 신규 배치부터 기록)