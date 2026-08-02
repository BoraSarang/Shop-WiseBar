# TODO — Shop WiseBar (똑바)

업데이트: 2026-08-02

## 진행 중 (P1)

- [x] 상품 모델 + SwiftData 저장소 (T-10) — Product/PricePoint, ProductStore, SettingsStore
- [x] 몰 레지스트리 + URL 파서 (T-11) — Mall, MallParser (브랜드/스마트스토어/카탈로그/oliveyoung/oy.run)
- [x] PriceFetcher (T-12) — 올리브영 HTTP 완전 동작, 네이버는 IP 차단으로 P2 이동
- [x] 백그라운드 갱신 스케줄러 (T-13) — 15분 주기, 몰 간 병렬, 타임아웃 8/12초
- [x] 알림 엔진 (T-14) — UNUserNotificationCenter (권한 거부 상태는 서명 문제로 보류)
- [x] 통계 + 그래프 (T-15) — PriceStats + Swift Charts (실데이터 검증 대기: 포인트 2개 필요)
- [x] 메뉴바 팝오버 UI (T-16) — 상품 카드/URL 등록/갱신/목표가/삭제/브라우저 열기
- [x] 우클릭 메뉴 실기능 (T-17) — 찜 관리/상품 추가/지금 갱신 활성화
- [x] **P1 실테스트 완료** (docs/tests/v0.2.0_macos.md, 올리브영 실상품 39900원)
- [ ] 그래프 라인 실데이터 검증 (가격 변동 발생 시 자동 기록 — 대기)
- [ ] 알림 권한 문제 해결 (ad-hoc 서명 → 개발자 서명 시 재확인)

## 다음 (P2)

- [ ] 브라우저 세션 파서 (T-20~23): 네이버(쿠팡) — `__PRELOADED_STATE__` 추출 + m. 페이지 우선
- [ ] 네이버 수집: HTTP 429 확정 → 브라우저 세션으로 전환 (2026-08-02 실측)
- [ ] 쿠팡 수집: 브라우저 세션 (Akamai 우회)
- [ ] 웨일(Whale) AppleScript 지원 실측 (T-22)
- [ ] 쿠팡 JS injection 캡처 (T-23)

## 보류

- [ ] 쿠팡 파트너스 API 심사 (P4-T42)
- [ ] 익스텐션 검토 (P4-T41)
- [ ] 클립보드 감지 (P3)

## 버그 큐

- bd CLI 사용: `bd list --label macos` / `bd create ... --label macos`
- 현재 등록 버그 없음
- 참고: 네이버 IP 차단(429)은 2026-08-02 실측 — 브라우저 접속은 정상, 쿠키 없는 요청만 차단
