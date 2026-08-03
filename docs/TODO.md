# 똑바(Shop WiseBar) 작업 추적

> 재구성 v0.3.0 시작 (2026-08-03). 상태: 🔵 진행 / ✅ 완료 / ⏸ 보류

## T-67 — 연관 상품 자동 수집 (v0.5 — Phase 1 진행)
- [x] content.js: EXTRACT_RELATED — 상품 페이지 연관 섹션 카드 추출 (MallParser 규약 재사용, 가격 없어도 등록)
- [x] background.js: captureRelated — 연관 상품 upsert + 가격 업로드 (10개 제한, 메인 캡처 쿨다운 공유)
- [x] 스크롤 수집 보정: 자동 스크롤 제거 → 사용자 스크롤 시 새로 로드된 카드만 재수집 (RELATED_FOUND, 600ms 디바운스, 이중 중복 방지)
- [ ] 실기기 실측: 쿠팡/네이버/올리브영 상품 페이지 각 1회 — 초기 수집 + 스크롤 수집 확인 — 사용자 확인 필요
- [ ] Phase 2: 목록/검색 페이지 캡처 (쿠팡 검색 결과, 네이버 쇼핑 등)
- [ ] Phase 3: product_relations 관계 그래프 저장 (추천/핫딜 기반)

## T-65 — 가격 통계·추적자·방문 유도 (v0.4.0 — 완료)
- [x] 서버: ProductOut에 min_price/avg_price/price_count/watch_count 추가 (전 기록 집계)
- [x] 서버: WatchOut에 last_checked_at 추가
- [x] 팝업: 현재 상품 '역대 최저가'/'평균보다 저렴' 배지 + 통계 표시
- [x] 플로팅 패널: 가격 추이에 동일 배지 표시
- [x] 배지 3상태 개선 (기록 3개 미만 → '데이터 쌓이는 중' 안내, 오탐 방지)
- [x] 알림: 할인율 % 타이틀/메시지 강조
- [x] 찜 목록(팝업/플로팅): 3일 이상 미캡처 상품 '확인 필요' 배지 — 방문 캡처 유도
- [x] 실기기 확인 (수집/배지/찜 — 2026-08-03 사용자 확인)

## T-66 — 알림 실기기 테스트 (보류 — 별도 모음)
> 5분 폴링 특성상 알림 테스트는 한 번에 모아서 검증하기로 함
- [ ] 찜 → 가격 하락 시뮬레이션 → 5분 내 브라우저 알림 ('가격 N% 내려갔습니다!' 확인)
- [ ] 알림 클릭 → 상품 페이지 오픈 확인
- [ ] 알림 내역(팝업)에 기록 확인

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
- [ ] 커밋

## 백로그 — 다음 회차 (일정 미정, 아이디어 기록)
- [ ] **핫딜 탭/추천 강화** — 하락폭 큰 상품 노출, 기간별 통계 등 (T-58 recommendations 확장)
- [ ] 서버 상시 구동 (launchd 자동 시작 — 재부팅 대응) — 사용자와 재논의 필요
- [ ] 알림 테스트 일괄 진행 (T-66과 합산 가능)

## 완료 이력
- 2026-08-03: 맥 메뉴바(v0.2.x) 전부 폐기 — git 히스토리로만 보존
