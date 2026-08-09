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