# PLAN v0.10.4_server — 일괄 업로드 API + DB 연결 풀 (T-93, T-94)

> 상태: 진행 중 (2026-08-06). 사용자 실사용 로그로 성능 문제 확인 → 일괄 업로드(A)는 필수, DB 연결 풀(B)은 수백 ms 단축.
> 세션 단절 대비: 이 문서가 먼저, 코드는 그 다음.

## 1. 개요

확장 실사용 [PERF] 로그에서 응답이 전반적으로 1~3초임을 확인:
- `POST /products/{id}/prices`: 1,400~3,200ms (예산 p95 < 300ms)
- `POST /products`: 1,000~3,100ms
- 연관 상품 40개를 **상품당 2개 요청 = 80개+ 개별 요청**으로 서버 처리량 초과

## 2. 원인 분석

1. **연관 상품 일괄 부재 (주 원인)**: `uploadRelatedItems`가 상품마다
   `POST /products` + `POST /products/{id}/prices` 개별 호출 (concurrency 5로 제한해도 80개 요청)
2. **DB 연결 풀 부재**: `database.py`의 `create_engine`이 풀 옵션 없음.
   PostgreSQL(Neon)은 요청마다 새 TCP+TLS 연결 → 1초대 연결 오버헤드

## 3. 결정 사항

### T-93 일괄 업로드 API
- **서버**: `POST /products/batch` — `items: [{product_id, mall, url, name?, image?, price?, source?}]` 배열 수신
  - 상품 upsert + 가격 업로드 로직을 재사용하되, **단일 트랜잭션**으로 커밋 (요청 1회)
  - 기존 개별 API와 동일한 dedup/통계 로직 유지
  - 응답: `{upserted, price_count, items: [...]}` — 부분 실패도 200 (로그만)
- **확장**: `uploadRelatedItems`에서 개별 루프 → **배치 청크(예: 20개/요청)로 1~2회 호출**
  - 메인 상품(수동 캡처)은 개별 API 유지 (실시간성, 단일 상품)
  - 연관 상품만 배치로 전환

### T-94 DB 연결 풀
- `database.py` — PostgreSQL이면 `pool_size=5, max_overflow=10, pool_pre_ping=True` (QueuePool)
- SQLite는 기존 유지 (로컬 테스트, 연결 풀 불필요)
- `pool_pre_ping` — 연결 끊김(Neon 재시작 등) 자동 감지

## 4. 구현 단계

- [ ] T-93a: 서버 `POST /products/batch` 라우터 + schema (`ProductBatchIn`) — 단일 트랜잭션 upsert+price
- [ ] T-93b: 확장 `uploadRelatedItems` → 배치 청크 전환 (개별 80요청 → 2~4요청)
- [ ] T-94a: `database.py` 연결 풀 (PostgreSQL QueuePool + pool_pre_ping)
- [ ] T-94b: pytest (batch 엔드포인트 + 기존 개별 API 회귀) + CHANGELOG + 커밋

## 5. 테스트 계획

| TC | 대상 | 검증 |
|----|------|------|
| TC-93-1 | /products/batch | 40개 배열 → upserted/price_count 정확 + 중복 product_id dedup |
| TC-93-2 | /products/batch | 가격 없는 상품은 upsert만 (price_count 0) |
| TC-93-3 | 기존 개별 API | /products + /prices 회귀 없음 (기존 24건 유지) |
| TC-94-1 | 연결 풀 | `pool_pre_ping` — 쿼리 후 정상 응답 |

## 6. 롤백 계획

- 배치 API는 추가만 — 개별 API 그대로 유지, 확장 배치 전환은 common.js revert로 복원
- 연결 풀 옵션은 env 플래그로 비활성 가능

## 7. 성능 영향

- 연관 40개: 80+ 요청 → 2~4 요청 (서버 부하 20배 감소)
- 연결 풀: 응답당 연결 1회 → 재사용, 수백 ms 단축 예상
- 검증: 사용자 [PERF] 로그로 배포 전후 비교

## 8. 에러코드

- 신규 불필요 (기존 E-SRV-* 재사용, batch는 부분 실패를 로그만)

## 9. DoD

- [ ] batch API pytest 통과
- [ ] 확장 배치 전환 + node --check
- [ ] 연결 풀 적용
- [ ] 기존 24건 회귀 통과 + CHANGELOG/TODO 반영
