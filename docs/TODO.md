# 똑바(Shop WiseBar) 작업 추적

> 재구성 v0.3.0 시작 (2026-08-03). 상태: 🔵 진행 / ✅ 완료 / ⏸ 보류

## T-60 — 익스텐션 뼈대 (진행)
- [x] manifest.json MV3 (권한: storage/alarms/notifications/tabs, host_permissions)
- [x] 기기ID 발급/등록 (background, crypto.randomUUID)
- [x] MallParser JS 포팅 (common.js — content/background 공용)
- [x] content.js 가격 추출 (네이버 상품 가격 패턴/쿠팡 % 패턴/올리브영 data-qa·tx_num)
- [x] 탭 이벤트 → 업로드 (쿨다운 10분, source=extension)
- [ ] 실기기 검증 (Chrome 개발자 모드 로드 + 상품 페이지 방문 → 서버 DB 확인) — 사용자 확인 필요
- [x] 아이콘 생성 (make_icons.py — 남색 원 + 하락 화살표)

## T-61 — 팝업 UI (진행)
- [x] 현재 상품 찜/찜 해제/목표가 (팝업 + 서버 watches)
- [x] 찜 목록 (썸네일/가격/목표가/해제)
- [x] 가격 추이 그래프 (캔버스 라인차트)
- [x] **플로팅 버튼 + 가격 추이 패널 (content script, shadow DOM)** — 상품 페이지 우하단, 클릭 시 추이
- [ ] 실기기 확인 — 사용자 확인 필요

## T-62 — 알림 (완료 — 코드 완성, 실기기 확인 필요)
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
- [ ] Edge/Whale manifest 호환 확인 (MV3 — 로드만 확인 필요)
- [ ] 옵션 페이지 (서버 URL 설정) — 보류 가능
- [ ] 테스트 기록: docs/tests/v0.3_crawler_poc.md 작성 완료
- [ ] 커밋

## 완료 이력
- 2026-08-03: 맥 메뉴바(v0.2.x) 전부 폐기 — git 히스토리로만 보존
