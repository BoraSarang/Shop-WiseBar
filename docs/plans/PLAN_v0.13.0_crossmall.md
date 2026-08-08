# PLAN v0.13.0 — 데이터 활용 고도화: 크로스몰 최저가 비교 + 구매 타이밍 인사이트

## 개요
여러 쇼핑몰(네이버/쿠팡/올리브영)에서 수집된 상품 데이터를 적극 활용해 두 가지 기능을 추가한다.
사용자 요청(신규 기능 제안) 기반으로, "이와 비슷한 다른 쇼핑몰 상품" = **크로스몰 동일상품 매칭**을 핵심으로 한다.

- **T-106**: 서버 — `products.normalized_name` 스키마 + 상품명 정규화(upsert 자동 계산 + 백필)
- **T-107**: 서버 — `ProductOut.alternatives` (동일상품 다른 몰 가격 비교) API 응답
- **T-108**: 확장 — 상세 패널 + 찜 목록에 크로스몰 비교 표시 (찜 비어 있을 때)
- **T-109**: 서버+확장 — 구매 타이밍 인사이트 (`stats` 확장 + UI 배지)

> 범위 제한: **품절 복귀 알림(T-110), 주간 트렌드 피드(T-111)** 는 사용자 합의로 v0.14로 이월.
> 버전: extension manifest 0.12.3 → **0.13.0**

## 결정 사항

| # | 결정 | 근거 |
|---|------|------|
| D1 | 동일상품 매칭은 `normalized_name` 동일 그룹 + 가격차 ±30% 교차로 제한 | 몰별 상품명 차이로 오탐이 많을 수 있음. 정확도 우선, 과탐 방지 |
| D2 | 매칭은 **조회 시 동적 계산** (별도 테이블/워커 없음) | 데이터 규모(현재 수백~수천)에서 정규화 컬럼 인덱스 동일 그룹 1쿼리로 충분. 최신 가격 항상 반영, 유지보수 단순 |
| D3 | `alternatives`는 상세 API 응답에 포함, 찜 목록은 `?include=alternatives` 옵션 | 리스트는 몰당 최대 2건, 조회가 원하면 한 번에. 볼륨 제어 |
| D4 | 매칭 실패 시 확장은 조용히(표시 없음) — UI에 오류 배지 없음 | 신규 기능, 회귀 방어. 사용자 불편 최소화 |
| D5 | 정규화 규칙 v1: 소문자→특수문자 제거→브랜드/모델 토큰 유지→몰별 불용어(세트/구성/포장/정품 등) 제거 | 몰마다 표기 차이를 최소화하는 실용적 수준 |

## 아키텍처

```
[DB]
products.normalized_name (String(512), index)  ← T-106
   ↓ 조회 시 동적 매칭
[매칭] normalized_name 동일 + 다른 mall + 가격차 ±30%
   - 최후 정렬: watch_count desc, last_price asc (인기/저가 우선), 몰당 최대 2건
   - 비용: 색인된 컬럼 동일 그룹 1쿼리 (수량 유의 없음)
[API]
   - GET /products/{id} → ProductOut.alternatives: [ProductAlternativeOut...]
   - GET /devices/{id}/watches?include=alternatives → 각 WatchOut.alternatives (배치 1쿼리로 N+1 방지)
[T-109] GET /products/{id}/stats 확장 — insight_badges (최저가 도달, 평균보다 낮음, 7일 추이)
[UI]
   - 플로팅 상세 패널: "다른 몰 가격" 섹션 (몰명·가격·워처 수·URL 이동)
   - 찜 목록: 아이템 "몰 별 {N}" 미니 배지 → 클릭 시 상세 패널 열기 (기존 상세 재사용)
   - 팝업 현재 상품/찜 목록: 동일 비교 행
```

## 구현 단계

### T-106 — 서버 스키마 + 정규화 (core)
- [ ] `models.py` — `Product.normalized_name` (String(512), index=True)
- [ ] `main.py` `_ensure_columns` — `normalized_name` (PG `IF NOT EXISTS`, SQLite PRAGMA+ALTER) + `INDEX_SQLS`에 인덱스
- [ ] `app/services/name_normalizer.py` 신규 — `normalize(name) -> str`:
  - 소문자화, 특수문자 → 공백 치환, 연속 공백 정리
  - 몰별 불용어(세트/구성/포장/정품/특가/선물/패키지 등) 토큰 제거 — 몰별 표기 차이 최소화
  - 브랜드/모델 번호(숫자·영문)는 유지 (핵심 식별자)
  - Falsey/예외 → None (매칭 제외)
- [ ] `products.py` `_upsert` — name 변경 시 자동 `normalized_name` 계산 (기존 상품 백필은 startup 1회: `normalized_name IS NULL` 재계산)
- [ ] tests: `test_normalizer.py` (몰 표기차 동일 판정 등)

### T-108 — 서버 API (alternatives)
- [ ] `schemas.py`: `ProductAlternativeOut` (product_id, mall, name, image, last_price, url, watch_count, diff_percent), `ProductOut.alternatives: list[...]`, `WatchOut.alternatives`
- [ ] `products.py` `_alternatives(db, product)` — normalized_name 동일 + mall != + last_price 없으면 제외 + 가격차 ≤30% → 최대 4건 (몰당 2)
- [ ] `products.py` `GET /products/{id}` + `list_products` → `_product_out`에 alternatives
- [ ] `watches.py` — `GET /devices/{id}/watches?include_alternatives=1` → 각 Watch에 alternatives (한 번에 batch 조회: 해당 상품들의 normalized_name 동일 그룹들만 IN 쿼리)
- [ ] tests: alternatives 노출/가격범위 초과 제외/같은 몰 제외/빈 리스트

### T-108 — 확장 UI (크로스몰 비교)
- [ ] `swb-ui.js` 상세 패널: "다른 몰 가격" 섹션 렌더 (`product.alternatives` — 몰명·가격·watchers·URL 이동 버튼 + "쿠팡이 x% 더 쌈" 캡션)
- [ ] `popup.js`: 현재 상품 섹션 + 찜 목록 아이템에 같은 비교 행 (첫 alternative 최저가 몰만 1줄 미리보기)
- [ ] 상세 오버레이 없는 찜 목록 아이템 → 클릭 시 기존 상세 패널 open 후 alternatives 섹션
- [ ] `node --check` 전체 + E2E 스냅샷

### T-109 — 구매 타이밍 인사이트
- [ ] `products.py` stats 확장: `insight_badges` 배열
  - `at_min_price` (last == overall min), `trend` (`down|up|flat` 7일 close 대비), `below_avg_percent` (avg 대비 %), `data_short` (price_count < 3)
- [ ] swb-ui 상세 패널 + 팝업: 기존 "지금 사도 돼" 배지 강화 — 위 값 렌더
- [ ] tests: insight 통계 충돌 케이스

## 테스트 계획 (TC)
- TC-CM-001: 동일 상품(네이버/쿠팡 2건, 정규화명 동일) → alternatives 에 1건 (상대 몰)
- TC-CM-002: 가격차 ±90%(같은 이름) → 제외 (범위 초과)
- TC-CM-003: 다른 상품(정규화명 다름) → alternatives 빈 배열
- TC-CM-004: 같은 몰 2건 → 매칭 제외 (몰 중 여)
- TC-INS-001: 마지막 타입 at_min=true + trend up → insight 표시
- TC-INS-002: 데이터 2포인트 이하 → insight 비활성(데이터 쌓는 중) 유지

## 롤백 계획
- 서버: 테이블/컬럼 Drop 없음 — `normalized_name`/`product_alternatives`만 추가, 응답 필드 추가는 하위 호환 (확장이 미지원 필드는 무시). 워커 비활성화는 startup guard
- 확장: alternatives 미표시 시 회귀 없음 (로드 실패 시 빈 목록)
- 릴리즈 전 요약: 적용 전 `turbo build --dry-run`, 필요 시 DB 삭제 대상 없음

## 성능 예산
- 유사상품 매칭 워커: 상품 5천개 수준→ 초 단위 이내
- `GET /products/{id}` alternatives: PK 조회 후 통합 쿼리 1회 (500ms 이내)
- 찜 목록 include=alternatives: 각 목록당 배치 쿼리 (Subquery로 N+1 방지)

## 에러코드
- 신규 코드 없음 — 기존 `E-EXT-NET-1001`(네트워크) 재사용, 서버는 Schema 예외는 기존 E-SRV-GEN-1001 경유

## 관련 문서
- `docs/api/ENDPOINTS.md`: alternatives/insight_badges 명세 갱신
- `docs/CHANGELOG.md`: v0.13.0
- `docs/TODO.md`: T106~T109 등록