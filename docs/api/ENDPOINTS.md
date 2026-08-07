# 똑바(Shop WiseBar) Server API 명세

> 버전: v0.9.2 · 플랫폼: server (FastAPI) · base: `https://shop-wisebar.onrender.com/api/v1` (로컬 `http://127.0.0.1:8000/api/v1`) · Swagger: `/docs`

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
| GET | `/products/{id}?device_id=&variant=` | 상품 조회 — 관심 여부(`is_watched`), 목표가(`target_price`), 통계(min/avg/count/watch_count). variant 지정 시 해당 옵션만 |
| POST | `/products` | 상품 upsert — `{product_id, mall, url, name?, image?, source?}`. `source=detail`은 이름 항상 갱신 / `card`는 최초 1회 |
| POST | `/products/{id}/prices` | 가격 업로드 — `{price, source: extension\|crawler\|client, variant?}`. 같은 가격은 dedup(통계만 집계), 품절 자동 해제 |
| GET | `/products/{id}/prices?limit=&variant=` | 가격 이력 (그래프용, 최신순) |
| GET | `/products/{id}/stats?variant=` | 가격 통계 요약 (v0.10.0) — `{period7, period30, overall}` 각각 `{min, min_date, avg}`. variant 지정 시 해당 옵션만 (price_points 기준), 없으면 price_daily_stats(low_price) 기준 |
| DELETE | `/products/{id}/prices/{price}?variant=` | 관리용 이상값 삭제. variant 생략=전체 / `__none__`=NULL variant |
| POST | `/products/{id}/sold-out` | 품절 상태 — `{sold_out: bool}` (확장 감지 시) |
| POST | `/products/relations` | 연관 관계 저장 — `{source, targets[]}` (weight += 1, 중복 제거) |
| GET | `/products/{id}/related?limit=` | 함께 본 상품 (양방향 weight 합산, 내림차순) |

## watches — 찜/목표가

| 메서드 | 경로 | 설명 |
|--------|------|------|
| PUT | `/devices/{did}/watches/{pid}` | 찜 등록/목표가 — `{target_price?}`. 없으면 목표가 **해제**(null 초기화, v0.9.2) |
| DELETE | `/devices/{did}/watches/{pid}` | 찜 해제 (204) |
| GET | `/devices/{did}/watches` | 내 찜 목록 — 상품명/최신가/품절/목표가/마지막 캡처 |

## alerts — 알림

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/devices/{did}/alerts?since=` | 폴링 알림 — `price_dropped` / `target_reached` / `sold_out` (증분, 중복 방지) |
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

## 데이터 저장 규칙

- `price_points`: 가격이 변할 때만 INSERT (`UNIQUE(product_id, captured_at)` 초 단위 방어)
- `price_daily_stats`: 일별 open/close/low/high/point_count 집계
- DB: SQLite(로컬 `shopwisebar.db`) / PostgreSQL(Neon, Render)