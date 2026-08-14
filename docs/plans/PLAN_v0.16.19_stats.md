# 매니저 "통계" 탭 구현 계획 (v0.16.19)

> 상태: 구현 진행 중 (2026-08-14)
> PLATFORM: server + macos (매니저)

## 개요

macOS 매니저 앱에 **"통계" 탭 신설** — 일별 수집 현황(몰별) / 가격 하락·상승 / 사용자 증가율 집계.

- 데이터 기반: 서비스 시작(8/3) 이후 상품 7,641, 가격포인트 7,523, 기기 84, 크롤러 배치 159.
- 수집량 급증(크롤러 도입 후 8/13 11,930회)으로 수집 통계가 크롤러 성과 지표로 유효.

## 결정 사항

- 화면 구성: **새 "통계" 탭** (기존 개요/상태/상품/크롤러/설정 5개에 추가)
- 우선순위: ① 일별 수집 현황(몰별) ② 가격 하락/상승 ③ 사용자 증가율
- 서버: `app/routers/stats.py` 신설, 기존 admin 라우터와 별도 파일 (stats.py), prefix `/api/v1`
- 기간 파라미터: `days` (기본 30, 최대 180), KST 날짜 기준 (admin.py 패턴 동일)

## 신규 API 4종

| API | 응답 | 데이터 소스 |
|---|---|---|
| `GET /admin/stats/collect-by-mall` | `{days: [{date, coupang, naver, oliveyoung}]}` | price_daily_stats JOIN products.mall, point_count SUM |
| `GET /admin/stats/price-movement` | `{days: [{date, up, down, flat}]}` | price_daily_stats 전일 close vs 당일 close (상품별) |
| `GET /admin/stats/top-movers` | `{drops: [...], risers: [...]}` (각 TOP 10, 5% 이상) | price_points — 마지막 포인트 vs 직전 max(하락)/min(상승) |
| `GET /admin/stats/users` | `{days: [{date, new_devices, active_7d, new_watches}]}` | devices.created_at / last_seen_at / watches.created_at |

### price-movement 판정 규칙
- 상품별 일별 `close_price` 시퀀스에서 전일 close vs 당일 close 비교
- down: 당일 < 전일 / up: 당일 > 전일 / flat: 동일 또는 첫날(전일 없음)
- KST 날짜 그리드 채움 (0 기본값)

### top-movers 규칙
- admin/insight의 drops 로직 재사용: 상품별 price_points 내림차순 정렬 → list[0] 최신
- drops: 최신 < 직전 max, `최신/직전 <= 0.95` (5%+ 하락)
- risers: 최신 > 직전 min, `최신/직전 >= 1.05` (5%+ 상승)
- 상품 메타(이름/이미지/URL/몰) join — N+1 방지 단일 조회

## 구현 단계

- [ ] T-1: PLAN + bd 태스크 등록
- [ ] T-2: 서버 stats.py 4종 구현 + main.py 등록
- [ ] T-3: pytest test_stats.py (몰별 수집/하락·상승/기기) 통과
- [ ] T-4: 매니저 — APIClient 모델/호출 + AppModel.refreshStats + StatsView 신설 + App.swift 탭
- [ ] T-5: xcodebuild 빌드 통과
- [ ] T-6: 커밋 — `feat(server): stats API`, `feat(macos): stats tab` 분리

## 테스트 계획 (TC)

- TC-1: collect-by-mall — 2개 몰 시드 후 몰별 SUM 일치
- TC-2: price-movement — 같은 상품 가격 캡처 2회(하락) 후 down 건수 반영
- TC-3: top-movers — 하락/상승 5% 경계 초과 시 drops/risers 포함, 미만 제외
- TC-4: users — 기기/찜 시드 후 신규 기기·활성·찜 증가 반영
- TC-5: 매니저 StatsView 뷰 렌더 (빌드 + 실행)

## 롤백 계획

- 서버: stats.py만 추가(기존 라우터 무변경) → 문제 시 파일 제거
- 매니저: 탭 1개 추가 → 문제 시 StatsView 제거 + Section에서 삭제
- git revert 가능 단위로 커밋 분리
