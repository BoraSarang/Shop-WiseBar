# 똑바(Shop WiseBar) 변경 이력

## v0.6.0 (2026-08-03) — [server] 가격 로우데이터 dedup + 일별 통계

- **가격 기록 구조 변경**: 가격이 **변할 때만** `price_points`에 INSERT (같은 가격 재방문은 로우 생성 없음)
  - 문제: 방문마다 로우가 쌓여 같은 가격이 중복 기록 — 가격 추이/차트 왜곡
- **신규 `price_daily_stats` 테이블**: 일별 1행 — `open_price/close_price/low_price/high_price/point_count` (UNIQUE(product_id, stat_date))
  - 방문은 전부 통계로 집계: 기존 178행이 89행으로 dedup, stats 78행 자동 생성
- **race 방어**: `captured_at` 초 단위 절단 + UNIQUE 위반 시 IntegrityError catch (동시 POST/이벤트 중복 호출에도 중복 INSERT 차단)
- **실기기 실측**: 해피바스 재방문 (같은 5,990원) → price_points 2행 유지 + point_count 3→5 증가 / 리멤버린 가격 변동 4,980→24,900 → 신규 로우 정상 캡처

## v0.5.0 (2026-08-03) — [extension] 연관 상품 자동 수집 (Phase 1)

- **상품 페이지 연관 상품 캡처**: 상품 페이지에서 "함께 비교하면 좋을 상품/비슷한 상품/이런 상품은 어때요" 등 연관 섹션의 상품 카드를 자동 수집해 카탈로그에 등록
  - 범용 추출기(`Extractor.extractRelated`): 특정 섹션명에 의존하지 않고 상품 링크 + 카드(이미지/이름/가격) 기반 — 몰 구조 변경에 견고
  - 가격이 노출되는 상품은 가격까지 저장 (`source=extension`), 가격 없는 상품은 카탈로그만 등록 (방문 시 가격 캡처)
  - **수집 시점 2단계**: ①페이지 로드 직후 1회 (현재 보이는 카드) ②사용자가 스크롤할 때 lazy 로딩으로 새로 로드된 카드만 재수집 (600ms 디바운스) — 자동 스크롤 금지
  - 중복 방지: content(relatedSentIds) + background(relatedUploadedIds) 이중 안전망, 1회 최대 10개
  - Phase 2(목록/검색 페이지), Phase 3(관계 그래프)는 예정

## v0.4.0 (2026-08-03) — [server] [extension] 가격 통계·추적자 수·방문 유도

- **서버 가격 통계 API 확장**: `GET /products/{id}` 응답에 `min_price`/`avg_price`/`price_count`/`watch_count` 추가 (전체 기록 기준 집계)
  - `watch_count` = 해당 상품을 추적 중인 기기 수 — "N명 추적" 지표
  - `GET /devices/{did}/watches` 응답에 `last_checked_at` 추가 (마지막 캡처 시각)
- **팝업 UI**: 현재 상품 섹션에 '역대 최저가'/'평균보다 저렴' 배지 + 평균·최저가·추적자 수 표시
- **플로팅 패널**: 가격 추이 패널에 동일 배지 추가 (서버 전체 통계 기준, 기간 필터와 별개)
- **브라우저 알림 강조**: 가격 하락 시 `가격 N% 내려갔습니다!` 타이틀 + `-N%` 할인율 표기
- **재방문 유도 (방문 캡처)**: 찜 목록(팝업/플로팅)에 3일 이상 미캡처 상품에 `확인 필요 · N일 전` 배지 — 클릭 시 상품 페이지 오픈 → 자동 캡처로 최신 가격 수집

## v0.3.1 (2026-08-03) — [extension] [server]

- **상품 페이지 플로팅 버튼 + 가격 추이 패널**: 상품 페이지 우하단 플로팅 버튼(하락 그래프 아이콘) → 클릭 시 해당 상품의 가격 추이 표시 (shadow DOM으로 페이지 스타일 격리)
  - 상품명 / 최근가 / 직전 대비 변동(▼▲) / 최저·최고가 / 이력 건수 / 캔버스 라인 그래프
  - 서버에서 실시간 조회 (`GET /products/{id}` + `/prices?limit=50`), 서버 다운 시 에러 안내 (E-EXT-NET-1001)
  - SPA 라우팅 대비 URL 변경 감시(2초 주기 location 비교)
- **공용 설정 통합**: `common.js`에 `SWB_CONFIG`(서버 주소 단일화) — background/popup/content 공유
- 기기ID 중복 발급 수정 + `init()` 중복 호출 제거 (기기 1개 고정 확인)

## v0.3.0 (2026-08-03) — [server] [extension] 전면 재구성

- **아키텍처 전환**: 맥 메뉴바 앱 폐기 → 중앙 서버 + 브라우저 익스텐션(Chrome MV3)
  - 맥 앱 코드 전체 제거 (git 히스토리로만 보존)
  - 수집 우선순위: ①서버 크롤러(올리브영 Playwright) ②익스텐션(전 몰) ③(폐기) 맥 메뉴바
- **결정 기록**: 크롤링 PoC 실측 결과 반영
  - 올리브영 서버 Playwright headless 성공 (403 우회, 가격+og 메타)
  - 네이버: 쿠키 없는 브라우저 전부 캡차 차단 / 쿠팡: Akamai Access Denied
  - → 네이버/쿠팡은 익스텐션이 유일한 자동 수집 채널
- docs 전면 재작성 (PRD/DESIGN/PLAN/TODO)

## v0.2.x (2026-08-02 ~ 08-03) — [macos] 레거시 (폐기)

- T-59 가격 변동 알림 3중 구조, 개발자 서명, 토스트 등 — v0.3.0에서 전면 폐기
