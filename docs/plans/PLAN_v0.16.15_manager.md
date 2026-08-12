# PLAN v0.16.15 — 똑바 매니저 관리 고도화 (P0/P1/P2)

> 버전: v0.16.15 · 플랫폼: server + macos + extension
> 상태: 🔵 진행 (2026-08-12) · 문서 우선 원칙
> 배경: 기존 매니저 6탭(조회 전용) 재검토 → 관리자 입장 관리 항목 4개 축 확정(사용자 승인).

## 개요

기존 "똑바 매니저"(v0.15.0)는 상품/통계/분석 조회 전용이었다. 운영 데이터 실측 결과
(devices 79·watches 17·products 5215·price_points 4994·alerts 5)에서 4가지 관리 공백을
식별했다: ①사용자 활동 추적 없음 ②서버 온라인 상태 대시보드 없음 ③많이 수집된 상품/최근
이슈 랭킹 없음 ④이상값/오탐 감지 없음. 사용자가 아래 4개 축을 **전부 선택**해 P0→P2 순 구현한다.

## 결정 사항

- P0(우선): 수집 상품 인사이트 + 서비스 헬스 — **스키마/확장 변경 없이** 서버 엔드포인트 + macOS 뷰로 즉시 가치. 가장 먼저.
- P1(차순): 사용자 활동 추적 — `_ensure_columns` 패턴으로 스키마 마이그레이션 + 확장 heartbeat 병합(기존 5분 폴링 재사용).
- P2(후순): 가격 동향 비교 — `normalized_name` + 기존 `_match_alternatives` 재사용.
- 인증 없음(기존 매니저 정책 유지), 운영 서버(`https://shop-wisebar.onrender.com`) 조회.
- 시간: 모든 노출 시각 KST (기존 `datetimeutil.KST` 재사용).

## 아키텍처

### P0 — 서버 엔드포인트 4종 (server/app/routers/admin.py 추가)

| 엔드포인트 | 응답 | 용도 |
|-----------|------|------|
| `GET /admin/products/top` | `{ most_collected, recent, sold_out, restocked }` | 많이 수집된 TOP20(watch+price_point 기준) + 최근수집 20 + 품절/복귀 20 |
| `GET /admin/products/{id}` | 상품 상세 + 가격 통계 + 관계 | 단일 상품 드릴다운 |
| `GET /admin/health` | `{ version, started_at, db, last_request, avg_ms }` | 서버 온라인 상태 (스키마 무관) |
| `GET /admin/crawler/summary` | `{ last_24h { runs, success, failed, gone, avg_duration_ms }, last_runs, stale }` | 크롤러 정상/이상 판정 |

### P0 — macOS 화면 (macos/ShopWiseBarManager/features/)

- `HealthView.swift` 신규 — "헬스" 탭: 서버 버전·시작 시각·DB 상태·최근 수집/가격변동 시각 + 크롤러 24h 성공률·stale 수.
- `InsightView.swift` / `StatsView.swift` 확장 — "많이 수집된 상품" 랭킹 + 상품 드릴다운.

### P1 — 스키마 + 사용자 활동 (server)

`_ensure_columns` 패턴 (main.py:72)으로 추가 (SQLite PRAGMA / PG IF NOT EXISTS):

- `devices.last_seen_at TIMESTAMPTZ` (nullable) — 최근 활동 시각
- `price_points.device_id VARCHAR(36)` (nullable, 인덱스) — 수집 출처 기기 연결
- `POST /devices/{id}/heartbeat` — last_seen_at 갱신
- `GET /admin/users` — 기기별: 활성 상태, 찜 수, 수집 건수(device_id), 최근 활동
- 확장: 기존 5분 폴링(`pollAlerts`) 시 heartbeat 호출 병합, 배치 업로드에 device_id 포함.

### P2 — 가격 동향 비교 (server)

- `GET /admin/price-compare` — `normalized_name`으로 동일상품 묶고 몰별 현재가, 몰별 최저차 %.
- `products.py:70 _match_alternatives` 로직 재사용 (동적 매칭).
- macOS 인사이트 탭 "몰 간 가격 비교" 섹션.

## 구현 단계

- [ ] T-126a PLAN/TODO/DESIGN 문서 작성 (본 문서)
- [ ] T-126b P0 서버: `/admin/health`, `/admin/crawler/summary` (+ tests)
- [ ] T-126c P0 서버: `/admin/products/top`, `/admin/products/{id}` (+ tests)
- [ ] T-126d P0 macOS: HealthView + Insight/Stats 확장 + APIClient/AppModel
- [ ] T-126e P1 서버: 스키마 마이그레이션 + heartbeat + `/admin/users` (+ tests)
- [ ] T-126f P1 확장: heartbeat 병합 + 배치 device_id 포함
- [ ] T-126g P1 macOS: 사용자 화면
- [ ] T-126h P2 서버: `/admin/price-compare` (+ tests) + macOS 인사이트 확장
- [ ] T-126i 검증: pytest 전체 + xcodebuild + 운영 실데이터 렌더 + 배포(0.16.15)

## 테스트 계획

- 서버: `tests/test_admin.py` 확장 — products/top·product detail·crawler summary·health·users·price-compare 각 케이스 + 기존 76건 회귀.
- macOS: `xcodebuild` Success + 운영 서버 실데이터 렌더 확인.
- 확장: `node --check` + heartbeat 호출 로그 확인.

## 롤백 계획

- 서버 엔드포인트: 커밋 revert → 재배포. 스키마는 ADD COLUMN만 추가라 무해(메타만).
- macOS: 이전 커밋 복원 + xcodebuild 재빌드.
- 확장 heartbeat: 로컬 릴로드로 즉시 원복.

## 성능 예산

- `/admin/products/top`: price_points 5000건 규모 단일 쿼리 → <300ms
- `/admin/health`: DB SELECT 1 + 메모리 상태 → <50ms (스키마 무관)
- `/admin/crawler/summary`: crawler_runs 121건 집계 → <100ms

## 에러 코드

- 신규 에러코드 없음 (조회 전용, 기존 E-SRV-GEN-1001 커버). 확장 heartbeat 실패는 기존 E-EXT-NET-1001 재사용.

## 관련 문서

- `docs/plans/PLAN_v0.15.0_admin-macos.md` — 기존 매니저 범위
- `docs/TODO.md`, `docs/DESIGN.md`, `docs/CHANGELOG.md`, `error_message_ko.json`
