# 똑바(Shop WiseBar) 작업 추적

> 재구성 v0.3.0 시작 (2026-08-03). 상태: 🔵 진행 / ✅ 완료 / ⏸ 보류

## T-73 — Phase 2: 목록/검색 페이지 캡처 (v0.8.0~v0.8.4 — 완료)
- [x] 원인: MallParser.parse가 상품 페이지만 인식 → 검색/목록 페이지는 수집 자체가 안 됨
- [x] common.js: MallParser.detectMall (product/listing 판별, 쿠팡 검색·네이버 쇼핑·스마트스토어·브랜드·올리브영)
- [x] content.js: 목록 페이지에서도 카드 수집 (초기 1회 + 스크롤), extractRelated currentProductID null 허용
- [x] background.js: listing 페이지 방문 감지 → captureRelated (pathname 기준 10분 쿨다운)
- [x] 서버: GET /products 목록 API (검증용)
- [x] 가격 오탐 수정 연쇄: 할부 문구(월 N원) → 네이버 스토어명 → "새 창에서 열림" 잡음 문구 (v0.8.1~v0.8.4)
- [x] 실기기 확인: 쿠팡 검색(엑씨/오리온 등) + 네이버 쇼핑 검색(lemonstar03 30개+) 정상 수집, 상품명/가격 정확 (2026-08-03 사용자 확인)
- [x] **찜 상품 배지 (v0.8.5~v0.8.6)**: 목록/검색 카드 + 상품 상세 이미지에 `★ 찜 N원` 뷰포트 고정 배지 — 이미지 안쪽 상단+8px, 스크롤 추적, 30초 캐시 + 찜 토글 무효화 (2026-08-03 사용자 확인 "어 이게 맞아")
- [x] (백로그 해소) 목록 페이지 찜 배지 — **올리브영 실측 완료 (2026-08-04)**: `getMCategoryList.do`(카테고리) / `getSearchMain.do`(검색) 모두 goodsNo 링크 → MallParser 지원 확인, 카드 LI.flag + A.prd_thumb 구조 → findCard 매칭, 검색 결과에서 실제 `★ 찜 17,010원` 배지 렌더 확인 (A000000185308 이즈앤트리)

## T-72 — 쿠팡 가격 추출 안정화 + 이상값 정리 (v0.7.7 — 완료)
- [x] 원인: 쿠팡 페이지가 정가/쿠폰가/사전구매 할인가를 여럿 노출 → 첫 `%` 매치가 렌더링 순서에 따라 번갈아 캡처 (Z Fold8 2,841,800↔958,800, 밴드톡 22,440↔20,190, Z Fold8 오탐 12,320)
- [x] content.js: `data-price` 속성 우선 추출 (쿠팡 표준 판매가 속성)
- [x] 서버: `DELETE /products/{product_id}/prices/{price}` 관리용 포인트 삭제 API
- [x] 배포 후 원격 오탐 포인트 정리 (Z Fold8 12,320 삭제 — min 958,800 정상화)
- [x] 사용자 실기기 확인 (2026-08-03 — "잘 되는 것 같아")

## T-69 — Render 콜드스타트 대응 (v0.7.1 — 완료)
- [x] 원인 파악: Render 무료 티어 15분 스핀다운 → 다음 요청 30~60초 → E-EXT-NET-1001
- [x] common.js에 `SWB_API` 공용 함수: 타임아웃 45초 + GET 콜드스타트 재시도 2회 + 404 특수 처리
- [x] popup.js/background.js/swb-ui.js 직접 fetch 전부 SWB_API로 통합 (직접 fetch 0건)
- [x] 팝업 초기화 로딩 표시 ("불러오는 중…")
- [x] 사용자 확장 리로드 후 실기기 확인 (Chrome/웨일 — 팝업·찜·추이·알림 정상, 2026-08-03 사용자 확인)
- [x] UptimeRobot 5분 핑 등록 완료 — /health 응답 0.3~0.6초 (콜드스타트 제거 확인)

## T-71 — 팝업 재편 + 플로팅 기능 확장 (v0.7.6 — 완료)
- [x] 팝업 순서: 현재 상품 찜 → 오늘의 핫딜 → 찜 목록
- [x] 알림 내역 팝업 제거 → 플로팅 이동 (메뉴 개수 뱃지)
- [x] 찜 목록 접이식 토글 (팝업)
- [x] 플로팅: 오늘의 핫딜 탭 (기간 토글 1/7/30일) + 알림 내역 탭
- [x] 실기기 확인 (팝업 순서/접이기, 플로팅 핫딜 5개 표시/알림 탭, 2026-08-03 사용자 확인)

## T-70 — 오늘의 핫딜 탭 (T-58 확장, v0.7.2~v0.7.3 — 완료)
- [x] 서버: /recommendations에 drop_percent(할인율%) 추가, 할인율 큰 순 정렬 (days=1/7/30)
- [x] 팝업: '오늘의 핫딜' 섹션 + 기간 토글(1일/7일/30일) + top 5 카드 (▼% 배지, 클릭 시 상품 페이지)
- [x] 성능: N+1 → 윈도우 함수 단일 쿼리 (Neon 59초 → 0.8초) + 복합 인덱스
- [x] 팝업 UX: 헤더 sticky 고정 + 섹션별 로딩 스피너(알림/핫딜/현재상품/찜목록) + 실패 문구
- [x] 플로팅 가격 추이에도 로딩 인디케이터 추가
- [x] 실기기 확인 (Chrome/웨일 팝업 — 핫딜 표시 + 기간 토글 + 상품 클릭, 2026-08-03 사용자 확인)

## T-68 — 가격 로우데이터 dedup + 일별 통계 (v0.6.0 — 완료)
- [x] price_points: 가격 변동 시에만 INSERT (같은 가격 재방문은 로우 생성 없음)
- [x] price_daily_stats 신규 테이블: 일별 open/close/low/high/point_count (UNIQUE product_id+stat_date)
- [x] race 방어: captured_at 초 단위 절단 + IntegrityError catch
- [x] 실기기 실측: 3사 방문 89행 dedup / 해피바스 재방문 point_count 3→5 / 리멤버린 가격 변동 정상 캡처 (2026-08-03 사용자 확인)

## T-67 — 연관 상품 자동 수집 (v0.5 — 완료)
- [x] content.js: EXTRACT_RELATED — 상품 페이지 연관 섹션 카드 추출 (MallParser 규약 재사용, 가격 없어도 등록)
- [x] background.js: captureRelated — 연관 상품 upsert + 가격 업로드 (10개 제한, 메인 캡처 쿨다운 공유)
- [x] 스크롤 수집 보정: 자동 스크롤 제거 → 사용자 스크롤 시 새로 로드된 카드만 재수집 (RELATED_FOUND, 600ms 디바운스, 이중 중복 방지)
- [x] SPA 이동 캡처: webNavigation.onHistoryStateUpdated (800ms 딜레이) — 올리브영 클릭 이동 확인 (A000000167392 22,950원)
- [x] 올리브영 전용 추출: CurationItem div 카드 → 이미지 URL goodsNo 파싱 (`A(\d+)ko\.jpg`) — 스크롤 후 2→22개
- [x] 가격 오매치 수정: `\d{1,3}(?:,\d{3})*` + 1,000~5,000만원 필터 — 쿠팡 12,9009,670 오탐 해결
- [x] 실기기 실측 완료: 쿠팡 42 / 네이버 41+11(롯데웰푸드) / 올리브영 22 = 총 116개 등록 (2026-08-03 사용자 확인)
- [x] Phase 2: 목록/검색 페이지 캡처 (쿠팡 검색 결과, 네이버 쇼핑 등) — **T-73에서 완료 (v0.8.0~v0.8.4)**
- [x] Phase 3: product_relations 관계 그래프 저장 — **v0.9.0 완료 (2026-08-04)**: 상품 페이지 연관 카드를 관계로 저장(weight 강도, 무방향 합산), GET /products/{id}/related + 플로팅 추이 '함께 본 상품' 섹션

## T-65 — 가격 통계·추적자·방문 유도 (v0.4.0 — 완료)
- [x] 서버: ProductOut에 min_price/avg_price/price_count/watch_count 추가 (전 기록 집계)
- [x] 서버: WatchOut에 last_checked_at 추가
- [x] 팝업: 현재 상품 '역대 최저가'/'평균보다 저렴' 배지 + 통계 표시
- [x] 플로팅 패널: 가격 추이에 동일 배지 표시
- [x] 배지 3상태 개선 (기록 3개 미만 → '데이터 쌓이는 중' 안내, 오탐 방지)
- [x] 알림: 할인율 % 타이틀/메시지 강조
- [x] 찜 목록(팝업/플로팅): 3일 이상 미캡처 상품 '확인 필요' 배지 — 방문 캡처 유도
- [x] 실기기 확인 (수집/배지/찜 — 2026-08-03 사용자 확인)

## T-66 — 알림 실기기 테스트 (완료 — v0.6.1)
- [x] 찜 → 가격 하락 시뮬레이션 → 5분 내 브라우저 알림 ('가격 N% 내려갔습니다!' 확인) — 크롬/웨일 각 1건
- [x] 알림 클릭 → 상품 페이지 오픈 확인
- [x] 알림 내역(팝업)에 기록 확인
- [x] 알림 폴링 버그 발견·수정: since 분기에서 직전 가격을 since 이전으로만 한정 → 찜 후 첫 하락 미감지 (v0.6.1)

## T-60 — 익스텐션 뼈대 (완료)
- [x] manifest.json MV3 (권한: storage/alarms/notifications/tabs, host_permissions)
- [x] 기기ID 발급/등록 (background, crypto.randomUUID)
- [x] MallParser JS 포팅 (common.js — content/background 공용)
- [x] content.js 가격 추출 (네이버 상품 가격 패턴/쿠팡 % 패턴/올리브영 data-qa·tx_num)
- [x] 탭 이벤트 → 업로드 (쿨다운 10분, source=extension)
- [ ] 실기기 검증 (Chrome 개발자 모드 로드 + 상품 페이지 방문 → 서버 DB 확인) — 사용자 확인 필요
- [x] 아이콘 생성 (make_icons.py — 남색 원 + 하락 화살표)

## T-61 — 팝업 UI (완료)
- [x] 현재 상품 찜/찜 해제/목표가 (팝업 + 서버 watches)
- [x] 찜 목록 (썸네일/가격/목표가/해제)
- [x] 가격 추이 그래프 (캔버스 라인차트)
- [x] **플로팅 버튼 + 가격 추이 패널 (content script, shadow DOM)** — 상품 페이지 우하단, 클릭 시 추이
- [x] 실기기 확인 (2026-08-03 사용자 확인)

## T-62 — 알림 (완료 — 코드 완성, 실기기 확인은 T-66에서 모음)
- [x] chrome.alarms 폴링 (5분)
- [x] chrome.notifications (price_dropped/target_reached)
- [x] 알림 클릭 → 상품 페이지 오픈 (storage.session 매핑)
- [x] since 커서 중복 방지

## T-63 — 서버 (완료)
- [x] source=extension 허용 (스키마 주석 갱신 — String(16) 자유값)
- [x] 올리브영 Playwright 크롤러 (UA 필수 실측 반영, 39,900원 수집 성공)
- [x] 크롤러 워커 정리 (worker.py → oliveyoung.run_once)
- [x] E2E 검증: device → upsert → price(extension) → watch → alerts(하락/목표가/증분)

## T-64 — 마무리 (진행)
- [x] Whale(웨일) MV3 로드 확인 — 2026-08-03 사용자 실기기 테스트 완료 (수집/배지/찜 정상)
- [ ] Edge 확인 — ⏸ 보류 (웨일이 크로미움 계열이므로 로드 확인 정도만 남음)
- [ ] 옵션 페이지 (서버 URL 설정) — 보류 가능
- [x] 테스트 기록: docs/tests/v0.3_crawler_poc.md 작성 완료
- [x] 커밋

## 백로그 — 다음 회차 (일정 미정, 아이디어 기록)
- [x] **핫딜 탭/추천 강화** — **v0.8.26 완료**: 하락 상품 부족 시 역대 최저가 갱신 상품(reason=low) 채움 + variant 중복 1건 + 팝업/플로팅 '최저가' 배지 (v0.8.28) (2026-08-04)
- [x] Phase 2: 목록/검색 페이지 캡처 (쿠팡 검색 결과, 네이버 쇼핑 등) — T-73 완료
- [x] Phase 3: product_relations 관계 그래프 저장 — **v0.9.0 완료 (2026-08-04)**: 상품 페이지 연관 카드를 관계로 저장(weight 강도, 무방향 합산), GET /products/{id}/related + 플로팅 추이 '함께 본 상품' 섹션
- [x] 알림 테스트 일괄 진행 — **2026-08-04 완료**: variant=None 품절 잔존(9,880원)이 알림 하락 오탐을 만드는 문제 발견 → v0.8.27 품절 price-container 스킵 + DELETE variant 정밀 삭제 + 오리온 정리, 정상 하락(10,600→10,520)만 감지 확인
- [~] 공식 API 연동 (옵션 C) — **제외 결정 (2026-08-03, 사용자)**: 쇼핑몰 계약/심사 불필요, 익스텐션 수집으로 충분

## 완료 이력
- 2026-08-03: 맥 메뉴바(v0.2.x) 전부 폐기 — git 히스토리로만 보존
