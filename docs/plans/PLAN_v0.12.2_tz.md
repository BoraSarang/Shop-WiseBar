# PLAN v0.12.2 — 시간대 통일 (KST 기준, T-102)

> 버전: v0.12.2 / 플랫폼: server + chrome(확장) / 상태: ✅ 완료 / 작성: 2026-08-06
> 관련: docs/TODO.md T-102, docs/CHANGELOG.md v0.12.2

## 1. 개요

시간 처리 전반을 종합 검토한 결과 3가지 문제 발견:

1. **일(daily) 집계·통계가 UTC 기준** — 서버(`_apply_price` `stat_date = now.date()`, stats `cutoff`, `min_date`)가 UTC 날짜로
   계산. 확장 그래프는 로컬(KST) 일자로 dedup → **한국 00~08:59 수집분이 서버에선 전날 통계로 집계되어 하루 어긋남**.
2. **핫딜 추천 cutoff가 UTC** — 최근 7일 하락 경계가 UTC.
3. **디버그 로그가 GMT(UTC) 표시** — `debug.js:125` `toISOString()` 변환 → KST보다 9시간 빠르게 보임.

DB는 UTC 저장을 유지하되 **일 경계·통계·표시를 KST(UTC+9) 기준으로 통일**한다 (한국 사용자 전용).

## 2. 결정 사항

1. **DB 저장**: 기존 UTC aware 유지 (models.py `datetime.now(timezone.utc)`, `DateTime(timezone=True)`).
   데이터 마이그레이션 없음 — 신규 수집부터 KST 일로 집계, 기존 UTC stat_date는 유지(기간 경계 인접 데이터만 일시 혼재, 영향 미미).
2. **KST 헬퍼**: `server/app/datetimeutil.py` 신규 — `KST = timezone(timedelta(hours=9))`, `kst_date(now=None)`.
3. **일(daily) 경계**: `_apply_price` `stat_date`를 `now.astimezone(KST).date()`로.
4. **통계 기간**: `get_product_stats` `today`를 KST 날짜로, variant 조회 cutoff를 KST 자정, `min_date`를 KST 날짜로 반환.
5. **핫딜 추천**: cutoff를 KST 시각 기준으로 (SQLite naive 처리 유지).
6. **디버그 로그**: `debug.js` 표시를 로컬 시각(KST) 수동 포맷 `YYYY-MM-DD HH:mm:ss.SSS`로 (로케일 형식 변동 없이 기존 파서 호환).
7. **확장 UI**: 서버가 KST `min_date`를 내려주므로 팝업 `fmtDate`·그래프는 수정 불필요 (그래프는 이미 KST).

## 3. 아키텍처

```
server/app/datetimeutil.py  # 신규 — KST 상수 + kst_date()
server/app/routers/products.py       # _apply_price(240) · get_product_stats(136~160)
server/app/routers/recommendations.py# cutoff(36)
extension/debug.js                   # 로그 시간 표시(125)
```

## 4. 구현 단계 (T-번호)

- [x] **T-102a** `server/app/datetimeutil.py` 신규 (KST, kst_date)
- [x] **T-102b** `products.py` — `_apply_price` stat_date KST + `get_product_stats` today/cutoff/min_date KST
- [x] **T-102c** `recommendations.py` — 핫딜 cutoff KST
- [x] **T-102d** `debug.js` — 로그 표시 로컬(KST) 수동 포맷
- [x] **T-102e** 검증 — 서버 pytest 회귀 + `node --check` + `run-e2e.sh`
- [x] **T-102f** 문서 — CHANGELOG v0.12.2 + 세션 로그

## 5. 테스트 계획 (TC-번호)

| TC | 내용 | 방법 |
|----|------|------|
| TC-TZ-001 | UTC 2026-08-05T16:00 (KST 08-06 01:00) 저장 → stat_date=2026-08-06 | pytest (daily_stats stat_date KST 검증) |
| TC-TZ-002 | stats cutoff: KST 오늘 기준 7일/30일 + min_date KST | pytest |
| TC-TZ-003 | 핫딜 cutoff KST 시각 기준 | pytest 회귀 |
| TC-TZ-004 | 디버그 로그가 로컬(KST) 시각으로 표시 | node 스니펫 검증 |
| TC-TZ-005 | 기존 pytest 32건 회귀 유지 | pytest 전체 |

## 6. 롤백 계획

- T-102 단위 커밋 → `git revert <commit>` 개별 롤백
- 서버: datetimeutil 제거 + products/recommendations 원복 → 재배포
- 확장: debug.js 원복 (즉효)

## 7. 성능 예산 / 영향

- timezone 변환은 쿼리 외 단일 연산 — 성능 영향 없음
- 기존 저장 데이터 불변 (UTC 유지) — 데이터 무결성 영향 없음

## 8. 에러코드 / 권한 / API / 캐시

- 신규 에러코드 없음. 권한/API 경로/캐시 정책 불변
- `min_date`가 KST로 내려오는 **의미 변경** — API 소비자(확장)는 표시만 하므로 호환

## 9. 문서 업데이트

- [x] `docs/plans/PLAN_v0.12.2_tz.md` (본 파일)
- [x] `docs/TODO.md` T-102 등록
- [x] `docs/CHANGELOG.md` v0.12.2
- [x] `.agent/session-2026-08-06-tz.md` 진행 저장