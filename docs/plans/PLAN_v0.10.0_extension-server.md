# PLAN v0.10.0_extension-server — 가격 통계·시계열 요약 (T-88)

> 상태: 진행 중 (2026-08-05). 다음 단계: 4(품질) → 1(스토어 배포) → 2(서버 운영, 나중)
> 세션 단절 대비: 이 문서가 먼저, 코드는 그 다음.

## 1. 개요

사용자가 가격 추이 그래프만 보고 "지금 사도 되나" 판단해야 하는 현재 UX를 개선.
`price_daily_stats`(이미 존재) 기반으로 **주간/월간 요약(최저가·평균가·최저가 날짜)** 을 서버 API로 제공하고,
확장(팝업 + 플로팅 추이)에 표시한다. 뷰바 핵심 가치인 "지금 사도 되는 가격"을 숫자로 제시.

## 2. 결정 사항

- **서버**: `GET /products/{id}/stats` 신설 — 7일/30일 요약 반환
  - `{ period7: { min, avg, min_date }, period30: { min, avg, min_date }, overall_min, overall_min_date }`
  - `price_daily_stats` 집계 (로우 `price_points`보다 가볍고, dedup 정책과 일관)
- **확장 팝업**: 가격 추이 그래프 위 요약 배너 — "7일 최저 {N}원 / 30일 평균 {M}원 / 역대 최저 {N}원 (Y-m-d)"
- **플로팅 추이 패널**: 팝업과 동일 요약 1줄 추가
- **variant 처리**: 추이 그래프가 variant 지정 시 해당 variant로만 조회하므로, stats도 variant 조건 지원 (기존 `_product_stats` 패턴 재사용)
- **비용**: 서버 API 1개 + 확장 렌더링 2곳. SQLite/Render 무료 티어 유지

## 3. 아키텍처

```
[확장 popup.js] ─ GET /products/{id}/stats ─▶ [server products.py router]
[확장 swb-ui.js]  ──────────────────────────▶  [SQL: price_daily_stats GROUP BY]
   요약 배너(7일/30일/역대) ◀─────────────────  [JSON: period7/period30/overall]
```

- `_variant_last_price` / `_product_stats` 패턴 재사용, variant는 쿠팡만 사용
- 기존 `/prices` (그래프 로우)는 변경 없음 — 요약은 별도 엔드포인트로 분리

## 4. 구현 단계

- [ ] T-88a: 서버 `GET /products/{id}/stats` 라우터 + schema (`docs/api/ENDPOINTS.md` 갱신)
- [ ] T-88b: 팝업 요약 배너 (popup.js + popup.html + popup.css) — 그래프 위 1줄
- [ ] T-88c: 플로팅 추이 요약 (swb-ui.js) — 패널 하단 1줄
- [ ] T-88d: 로컬 서버 통합 테스트 (curl stats API → 팝업/플로팅 렌더)
- [ ] T-88e: 버전 상승 + CHANGELOG + 커밋

## 5. 테스트 계획

| TC | 시나리오 | 확인 |
|----|----------|------|
| TC-88-1 | stats API (variant 없음) | 7일/30일/역대 min·avg·min_date 정확 |
| TC-88-2 | stats API (쿠팡 variant 지정) | 해당 variant만 집계 |
| TC-88-3 | 데이터 없음 | overall_min null, 프론트 대체 텍스트 |
| TC-88-4 | 팝업/플로팅 렌더 | 요약 배너 노출 + 그래프 로드 병행 |

## 6. 롤백 계획

- 서버: 라우터 추가만(테이블/마이그레이션 없음) — 파일 revert로 충분
- 확장: 요약 배너 코드 revert
- `price_daily_stats` 데이터는 기존 유지 (파괴 없음)

## 7. 성능 예산

- stats 쿼리: `price_daily_stats` 2회 GROUP BY (7일/30일) + 1회 전체 min — 100ms 이내
- 팝업/플로팅: 기존 그래프 로드와 병렬 fetch, 렌더 50ms 이내

## 8. 에러코드

- 기존 재사용: E-EXT-NET-1001 (연결 실패) / E-SRV-DB-1001 (상품 없음)
- 신규 불필요

## 9. 권한 목록

- 변경 없음 (기존 permissions 유지)
