# PLAN_v0.16.9_crawler-diagnosis — 운영 크롤러 count=0 고착 진단 및 해결

> 상태: 🔵 진행 — 2026-08-10
> 버전: v0.16.9 (server)
> 목표: 운영(미국 IP)에서 oliveyoung 배치가 계속 gone/error만 반복하고 `count=0`이 고착된 원인을 진단·해결.

## 1. 배경 (실측 이력)

| 배치 (KST) | 결과 | 비고 |
|---|---|---|
| 2026-08-10T13:12 | oliveyoung c=0/3 gone=0 fail=3 | 배포 전(0.16.7) — 소멸 상품 반복 재시도 |
| 2026-08-10T13:25 | oliveyoung c=0/3 gone=2 fail=1 | err=`og:title 없음 body=89자` |
| 2026-08-10T13:29 | oliveyoung c=0/3 gone=3 fail=0 | v0.16.8 |
| 2026-08-10T13:36 | oliveyoung c=0/3 gone=3 fail=0 | v0.16.8 |
| 2026-08-10T13:38 | oliveyoung c=0/3 gone=2 fail=1 | err=`og:title 없음 body=89자` |
| 2026-08-10T13:44 | oliveyoung c=0/3 gone=3 fail=0 | v0.16.8 |

- oliveyoung 상품 148개, priced(가격 기록 있음) 147개 — 클라이언트로 수집된 유효 상품이 다수.
- 배치에서 계속 gone=3만 반복 → **모든 후보가 소멸/오류로 판정되어 count=0 고착**.

## 2. 의심 원인

1. **미국 IP 렌더 오판**: 운영 서버(미국)에서 올리브영 페이지가 헤더만(100~180자) 렌더되어
   - og:title 미탐지 → error(`og:title 없음 body=89자`)
   - tiny(<180자) 분기 → gone 오판
   로컬(한국 IP)에서는 511자로 정상 렌더(실측 완료) — **IP/로케일 의존성 의심**.
2. **gone 순환**: 소멸 상품은 last_checked_at 갱신돼도 60분 후 다시 stale pool로 복귀해 배치를 계속 점유.

## 3. 결정 사항

- 임시 진단 엔드포인트 `/admin/crawler/diag/products|fetch` 추가 — 운영 DB 상품 상태 + 단일 상품 fetch 결과(body 미리보기) 노출.
- 하나의 정상 상품으로 fetch 시뮬레이션 → 미국 IP에서 body/og:title 실제 렌더 확인 → 오판 확정.
- 오판이면: 렌더 대기 강화 / 판정 분기 조정 / 사용자 에이전트·로케일 세분화.
- 소멸 상품 순환은 `last_checked_at`보다 긴 재확인 주기(예: 7일) 도입 검토.

## 4. 구현 단계 (T-번호)

- [ ] **T-122a** admin 진단 엔드포인트 추가: `/admin/crawler/diag/products`(상품 목록+last_checked_at), `/admin/crawler/diag/fetch/{goods_no}`(fetch 결과 body 미리보기 + status/price)
- [ ] **T-122b** 운영 실측: 정상 상품 fetch → 미국 IP 렌더 확인 (body 길이/og:title/gone 여부)
- [ ] **T-122c** 원인 수정 (오판 시 판정 로직, 순환 시 stale 필터)
- [ ] **T-122d** 테스트 회귀 + 배포 + 운영 배치 재실측 (count>0 달성)

## 5. 테스트 계획

- pytest 회귀 (diagnosis 엔드포인트 + 기존 76건)
- 운영: diag fetch로 오판 확정 → 수정 후 배치 count>0 확인

## 6. 롤백 계획

- diag 엔드포인트는 admin 전용, 우려 시 제거
- 판정 로직 변경 시 v0.16.7/0.16.8 커밋(git revert)으로 복구

## 7. 성능 예산

- diag fetch는 필요한 경우에만 호출 (배치 로직 미변경) — 운영 부하 영향 없음