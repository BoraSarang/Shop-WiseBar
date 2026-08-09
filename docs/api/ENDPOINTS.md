# 똑바(Shop WiseBar) Server API 명세

> 버전: v0.15.0 · 플랫폼: server (FastAPI) · base: `https://shop-wisebar.onrender.com/api/v1` (로컬 `http://127.0.0.1:8000/api/v1`) · Swagger: `/docs`
> 신규: `/admin/*` 집계 엔드포인트 (v0.15.0, macOS 똑바 매니저 앱 전용, 조회 전용)

## 공통

- 인증 없음 — 익명 기기ID(`devices.id`, UUID)로 구분
- 에러: `{"detail": {"code": "E-SRV-...", "message": "..."}}`
  - `E-SRV-DB-1001` 상품 없음 / `E-SRV-DB-1002` 기기 없음
- product_id 규약: 쿠팡 상품번호 / `store:{store}:{id}` / `brand:{store}:{id}` / `c:{id}` / 올리브영 `goodsNo` / `oyrun:{url}`

## devices — 기기

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/devices` | 익스텐션 최초 기기ID 등록 (이미 있으면 재사용) — body `{device_id?}` |

## products — 상품/가격

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/products?limit=` | 최근 수집 상품 목록 (관리/검증용) |
| GET | `/products/{id}?device_id=&variant=` | 상품 조회 — 관심 여부(`is_watched`), 목표가(`target_price`), 통계(min/avg/count/watch_count), **`alternatives`**(v0.13.0: 정규화명 동일 + 다른 몰 + 가격 ±30% 동일상품, 가격 낮은순 몰당 최대 3 — `{mall, name, url, last_price, diff_percent, watch_count}`). variant 지정 시 해당 옵션만 |
| POST | `/products` | 상품 upsert — `{product_id, mall, url, name?, image?, source?}`. `source=detail`은 이름 항상 갱신 / `card`는 최초 1회 |
| POST | `/products/{id}/prices` | 가격 업로드 — `{price, source: extension\|crawler\|client, variant?}`. 같은 가격은 dedup(통계만 집계), 품절 자동 해제 |
| GET | `/products/{id}/prices?limit=&variant=` | 가격 이력 (그래프용, 최신순) |
| GET | `/products/{id}/stats?variant=` | 가격 통계 요약 (v0.10.0) — `{period7, period30, overall}` 각각 `{min, min_date, avg}` + **`insight_badges`**(v0.13.0: 3포인트 이상일 때 `역대 최저가 달성`/`평균보다 N% 저렴`/`7일 최저가 도달`). variant 지정 시 해당 옵션만 (price_points 기준), 없으면 price_daily_stats(low_price) 기준 |
| DELETE | `/products/{id}/prices/{price}?variant=` | 관리용 이상값 삭제. variant 생략=전체 / `__none__`=NULL variant |
| POST | `/products/{id}/sold-out` | 품절 상태 — `{sold_out: bool}` (확장 감지 시) |
| POST | `/products/relations` | 연관 관계 저장 — `{source, targets[]}` (weight += 1, 중복 제거) |
| GET | `/products/{id}/related?limit=` | 함께 본 상품 (양방향 weight 합산, 내림차순) |

## watches — 찜/목표가

| 메서드 | 경로 | 설명 |
|--------|------|------|
| PUT | `/devices/{did}/watches/{pid}` | 찜 등록/목표가 — `{target_price?}`. 없으면 목표가 **해제**(null 초기화, v0.9.2) |
| DELETE | `/devices/{did}/watches/{pid}` | 찜 해제 (204) |
| GET | `/devices/{did}/watches` | 내 찜 목록 — 상품명/최신가/품절/목표가/마지막 캡처. `?include_alternatives=true`(v0.13.0) 시 각 상품에 `alternatives`(동일상품 타 몰 비교) 포함 |

## alerts — 알림

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/devices/{did}/alerts?since=` | 폴링 알림 — `price_dropped` / `target_reached` / `sold_out` / `back_in_stock`(v0.14.0: 품절→재판매 복귀, since 이후 1회, 최초 폴링 미발생) (증분, 중복 방지) |
| POST | `/devices/{did}/alerts` | 감지 알림 히스토리 배치 저장 — `[{product_id, alert_type, price, previous_price}]` |
| GET | `/devices/{did}/alerts/history` | 알림 내역 (최신 50건, 초과 시 오래된 것 정리) |
| DELETE | `/devices/{did}/alerts/{alert_id}` | 알림 삭제 (204) |

## recommendations — 핫딜 추천

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/recommendations?limit=&days=` | 기간(1/7/30일) 내 하락 5%+ 상품 → 부족분은 역대 최저가 갱신 상품(`reason=low`)으로 채움 |

## deals — 공개 핫딜 피드 (T-105, v0.12.3)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/deals/public?limit=&days=` | 전체 사용자 실측 하락/최저가 상품 익명 집계. `/recommendations`와 달리 device_id 무관. 응답에 `watchers`(찜 수) 포함. 5분 인메모리 캐시. |

## 기타

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET/HEAD | `/health` | 헬스체크 `{status, version}` — UptimeRobot 5분 핑 |

## admin — 집계 조회 (v0.15.0, T-115a, macOS 똑바 매니저 앱용)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/admin/overview` | 전체 개요 — `{products, devices, watches, price_points, daily_stats, alerts, relations, priced, sold_out}` |
| GET | `/admin/trend?days=` | 일별 시리즈(KST) — `{days: [{date, captures, points, new}]}` (1~180일) |
| GET | `/admin/malls` | 몰별 집계 — `{malls: [{mall, products, avg_price, watchers, priced}]}` (coupang/naver/oliveyoung) |
| GET | `/admin/collect` | 수집 통계 — `{sources: [{source, count}], total, last_capture_at}` |
| GET | `/admin/insight?days=` | 인사이트 — `{alert_distribution, recent_alerts, top_drops}` (top_drops: 최근가가 직전 대비 5%+ 하락 TOP 20) |
| GET | `/admin/crawler/config` | 크롤러 설정 조회 (v0.16.0) — `{interval_seconds, enabled, run_requested, last_run_at}` |
| PUT | `/admin/crawler/config` | 크롤러 설정 변경 (v0.16.0) — `{interval_seconds?, enabled?}`. `interval_seconds`는 {3600,10800,21600,43200,86400}(1/3/6/12/24시간)만 허용, 외 값 422. worker가 다음 틱(30초)에 반영 |
| POST | `/admin/crawler/run` | 즉시 수집 요청 (v0.16.0) — `run_requested=true` 설정. worker가 다음 틱 내 1배치(oliveyoung+naver) 소비 → `{status:"requested"}` |
| GET | `/admin/crawler/logs?limit=` | 크롤러 배치 이력 (v0.16.0, 기본 50/최대 200) — `{logs: [{mall, success, count, attempted, failed, duration_ms, trigger, run_at(KST)}]}`. `attempted`/`failed`는 v0.16.2(T-119) 추가 — `failed = attempted - count` |

- `/admin/trend` 집계 기준: `captures` = `price_daily_stats.point_count` 합, `points` = `price_points` 건수, `new` = 신규 상품.
  일자 경계는 KST(UTC+9) 기준 — 그래프와 확장 로컬 표시가 하루 어긋나지 않도록 함.

## 데이터 저장 규칙

- `price_points`: 가격이 변할 때만 INSERT (`UNIQUE(product_id, captured_at)` 초 단위 방어)
- `price_daily_stats`: 일별 open/close/low/high/point_count 집계
- `products.normalized_name` (v0.13.0): 소문자화 → 특수문자 공백 치환 → 불용어(세트/구성/패키지/정품/선물용 등) 토큰 제거. upsert 시 자동 계산, 기존 데이터는 startup 백필
- `products.back_on_sale_at` (v0.14.0): 가격 캡처로 품절(`sold_out_at`)이 해제되는 순간 기록 — 복귀 알림 감지용
- 크로스몰 alternatives (v0.13.0): 저장 테이블 없이 **조회 시 동적 매칭** — `normalized_name` 동일 + `mall` 다름 + 가격 ±30% (0.7~1.3배). 몰당 최대 3건, 가격 오름차순
- DB: SQLite(로컬 `shopwisebar.db`) / PostgreSQL(Neon, Render)