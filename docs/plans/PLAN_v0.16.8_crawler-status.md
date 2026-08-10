# PLAN_v0.16.8_crawler-status — 크롤러 이력 3상태(성공/실패/상품없음) + 실패 사유

> 상태: 🔵 진행 — 2026-08-10
> 버전: v0.16.8 (server) — macOS 매니저 크롤러 이력 행 개선

## 1. 개요

### 현재 문제
- 크롤러는 내부적으로 3상태를 구분함 — `fetch_goods`/`fetch` 반환: `{status:"ok"}` / `{status:"gone"}` / `None`(일시오류)
- 그러나 `run_once`가 `(attempted, success)` 2개 수로만 합산 반환 → **gone(상품없음)을 성공 제외 = "실패"로 퉁침**
- `crawler_runs`에 gone 건수·실패 사유를 저장하지 않음
- macOS 매니저는 `success`(Bool) 아이콘 + "대상 N건 중 성공 M · 실패 K"만 표시
  → "0건 수집"이 실패인지 상품없음인지 구분 불가 + 실패 사유를 알 방법이 없음

### 목표
- 매니저 크롤러 이력에서 **성공 / 실패 / 상품 없음 3상태를 구분 표시**
- 실패 시 **실패 사유**(챌린지 미해결 / 타임아웃 / 파싱 오류 등) 표시

## 2. 결정 사항

1. `crawler_runs`에 `gone`(int, 상품없음 건수) + `error`(text, 실패 사유) 컬럼 추가 — 마이그레이션은 기존 `_ensure_columns` 패턴 재사용 (SQLite PRAGMA / PG IF NOT EXISTS)
2. `run_once` 반환을 `(attempted, success, gone, error)` 4튜플로 확장 — `None`(fetch 불가)일 때 사유 문자열 누적
3. `worker._run_batch` — 실패(success=False)면 `error` 사유를 로그에 기록
4. `/admin/crawler/logs` 응답에 `gone` + `error` 추가
5. macOS: `CrawlerLog`에 `gone`/`error` 반영 + 이력 행을 **성공/실패/상품없음 3색 배지**로 + 실패 시 사유 툴팁·텍스트
6. 이전 응답(전 버전)과의 하위 호환: `gone` 없으면 0, `error` 없으면 nil

## 3. 아키텍처

- **서버**: `crawlers/*.py` `run_once` → 4튜플 / `models.CrawlerRun` 컬럼 2개 / `router.admin.crawler_logs` 응답
- **macOS**: `APIClient.CrawlerLog` + `CrawlerView.logRow` — 상태 배지 3종 + 사유 텍스트
- 기존 확장(extension)은 크롤러 이력을 안 보므로 영향 없음

## 4. 구현 단계 (T-번호)

- [ ] **T-121a** 서버: `CrawlerRun.gone`(default 0) + `CrawlerRun.error`(nullable text) 모델 + `main.py _ensure_columns` 마이그레이션
- [ ] **T-121b** 서버: `oliveyoung.run_once`/`naver.run_once` → `(attempted, success, gone, error)` 반환 (fetch None 시 사유 수집 — 브라우저 예외 메시지/이유)
- [ ] **T-121c** 서버: `worker._run_batch` — gone/error 저장 + 실패 시 error 기록
- [ ] **T-121d** 서버: `admin.crawler_logs` 응답에 gone/error (+ 테스트)
- [ ] **T-121e** macOS: `CrawlerLog` gone/error + `CrawlerView.logRow` 3상태 배지("성공"/"실패"/"상품 없음") + 실패 사유 표시
- [ ] **T-121f** 검증: pytest 회귀 + xcodebuild + 로컬/운영 실측(소멸 상품 gone 표시)
- [ ] **T-121g** 문서: CHANGELOG v0.16.8 / TODO / ENDPOINTS 반영 + 커밋·push + 배포

## 5. 테스트 계획

- 서버: `test_crawler.py` — run_once 4튜플 / gone·error 반영 / logs 응답 필드
- macOS: xcodebuild 성공
- 운영: `/admin/crawler/logs` 응답에 gone>0 (소멸 상품) 구분 확인

## 6. 롤백 계획

- 서버: 이전 커밋 git revert (모델 컬럼은 nullable·default로 하위 호환 — 기존 행 영향 없음)
- macOS: 별도 커밋이므로 서버 먼저 롤백 가능

## 7. 성능·비용

- 크롤러 반환/로깅 필드 추가 — 네트워크·DB 영향 미미 (배치당 1행)