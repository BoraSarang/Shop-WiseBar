# PLAN v0.10.1_server — 품질 개선: 서버 테스트 자동화 + DB 인덱스 점검 (T-89)

> 상태: 진행 중 (2026-08-05). 다음 단계: 1(스토어 배포) → 2(서버 운영, 나중)
> 세션 단절 대비: 이 문서가 먼저, 코드는 그 다음.

## 1. 개요

현재 서버에 **테스트가 전무**하다. CI(GitHub Actions)에는 확장 JS 구문 검증만 있고 서버 검증이 없다.
품질(4) 1차로 서버 pytest 테스트 스위트를 구축하고, DB 인덱스·메타 품질을 점검한다.

## 2. 결정 사항

- **pytest + FastAPI TestClient** 도입 — `server/tests/`에 API 통합 테스트 (DB는 임시 SQLite)
- **테스트 DB 격리**: `DATABASE_URL=sqlite:///:memory:` (또는 tmp 파일) + dependency override로 `get_db` 교체
- **CI 연동**: `.github/workflows/`에 서버 pytest job 추가 (validate-extension.yml 확장 또는 신규 server-test.yml)
- **DB 인덱스 점검**: `price_points`/`price_daily_stats`/`watches`/`alerts`/`product_relations` 인덱스 현황 확인 → 누락 시 `INDEX_SQLS`에 추가 (main.py 기존 패턴 재사용)
- **메타 품질**: og:image 등 메타 검증은 이미 존재(이미지 정규화), 우선순위 낮음 — 테스트에서 일부만 커버

## 3. 테스트 시나리오

| TC | 대상 | 검증 |
|----|------|------|
| TC-89-1 | devices 라우터 | 기기 등록/조회/삭제, watch CRUD |
| TC-89-2 | products 라우터 | upsert, 가격 업로드 dedup, stats, sold-out, prices 삭제 |
| TC-89-3 | relations | 관계 저장/조회 (양방향 weight) |
| TC-89-4 | recommendations | 기간별 하락/최저가 추천 |
| TC-89-5 | /health | 200 + status ok |

## 4. 구현 단계

- [ ] T-89a: pytest + httpx 의존성 (requirements.txt, 실제 실행은 .venv)
- [ ] T-89b: `server/tests/conftest.py` — TestClient + 임시 SQLite + 테이블 생성 + 세션 팩토리
- [ ] T-89c: `server/tests/test_*.py` — devices/products/relations/recommendations/health
- [ ] T-89d: DB 인덱스 점검 + 누락분 INDEX_SQLS 추가
- [ ] T-89e: CI server pytest job 추가
- [ ] T-89f: 실행·검증 + CHANGELOG + 커밋

## 5. 롤백 계획

- tests/: 파일 추가만 — 제거로 롤백
- INDEX_SQLS: 기존 패턴(IF NOT EXISTS)이라 파괴 없음
- 의존성: pytest 추가만, 런타임 의존 아님

## 6. 성능 영향

- 인덱스 추가 시 쓰기 약간 증가, 조회 개선. 데이터셋 506 상품 수준이라 영향 미미
- 테스트는 CI에서만 실행

## 7. 에러코드

- 신규 불필요 (테스트용)

## 8. DoD

- [x] pytest 전체 통과
- [x] CI job 추가
- [x] CHANGELOG/TODO 반영
