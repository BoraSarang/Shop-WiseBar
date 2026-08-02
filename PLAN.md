# PLAN — Shop WiseBar (똑바)

상태: `[x]` 완료 / `[ ]` 대기 · 최종 업데이트: 2026-08-02

## P0 — 프로젝트 골격

- [x] T-01 문서 정리 (PRD/DESIGN/PLAN/TODO/CHANGELOG/AGENTS 확장/AI_MODELS/error_message_ko)
- [x] T-02 표준 스크립트 (build_and_run.sh 디스패처 + scripts/build-macos.sh·screenshot.sh·env-expiry-check.sh)
- [x] T-03 Xcode 프로젝트 + 메뉴바 골격 (DebugLogger 8레벨 + DebugPanel Cmd+D)
- [x] T-04 빌드 검증 (`./build_and_run.sh debug macos`)
- [x] T-05 git init + .gitignore + .github PR 템플릿
- [x] T-06 세션 로그 (/.agent/session-*.md)

## P1 — 가격 추적 MVP ✅ (2026-08-02 완료 — 실상품 검증)

- [x] T-10 상품 모델 + SwiftData 저장소 (Product/PricePoint/Settings)
- [x] T-11 몰 레지스트리 + URL 파서 (쿠팡/네이버 브랜드·스마트스토어·카탈로그/올리브영 + oy.run)
- [x] T-12 PriceFetcher (올리브영 HTTP 완전 동작 / 네이버 HTTP 불가 확정 → P2 / 쿠팡 P2)
- [x] T-13 백그라운드 갱신 스케줄러 + 가격 이력 저장 (15분, 몰 간 병렬, 타임아웃 8/12초)
- [x] T-14 알림 엔진 (UNUserNotificationCenter — ad-hoc 서명 권한 문제, 개발자 서명 후 재확인)
- [x] T-15 가격 통계 (최저/최고/평균/변동률) + Swift Charts 그래프
- [x] T-16 메뉴바 팝오버 UI (상품 카드: 이미지·현재가·변동·그래프·목표가·삭제)
- [x] T-17 우클릭 메뉴 실제 기능 (찜한 상품 관리/지금 상품 추가/지금 갱신)
- [x] 실상품 검증: 올리브영 메디힐 39,900원 등록→수집→갱신 (docs/tests/v0.2.0_macos.md)

### P1에서 판명된 사항 (설계 변경)
- 네이버 직접 HTTP는 **IP 차단(429)으로 불가 확정** (2026-08-02 실측: 브라우저 접속 정상, 쿠키 없는 요청만 차단)
- 네이버 수집 → **P2 브라우저 세션으로 전환** (m. 모바일 페이지 + `__PRELOADED_STATE__` 파싱, 실측 완료)
- 스마트스토어 가격은 상태 JSON에 미포함 → body 텍스트 파싱 필요 (P2-T23 참고)

## P2 — 브라우저 연동 (우선순위 1)

- [ ] T-20 BrowserMonitor (AppleScript 폴링, 브라우저 선택 설정)
- [ ] T-21 몰 판별 + 상품 ID 추출 + "추적할까요?" 제안 UI
- [ ] T-22 웨일(Whale) AppleScript 지원 실측 → 실패 시 Accessibility 폴백
- [ ] T-23 쿠팡 JS 주입 가격 캡처 + 백그라운드 쿠팡 갱신 (비활성 탭 방식) — **네이버 브라우저 세션 수집 포함으로 확장**

## P3 — 클립보드 감지 (우선순위 2)

- [ ] T-30 ClipboardMonitor (NSPasteboard changeCount 폴링) + 공유 URL 파싱 (link.coupang.com 리디렉션 포함)

## P4 — 고도화

- [ ] T-40 확장 몰 추가 (무신사/11번가/컬리)
- [ ] T-41 Chrome 계열 익스텐션 검토 (2단계 — 포함 여부 판단)
- [ ] T-42 쿠팡 파트너스 API 재검토 (승인 시 백그라운드 갱신 안정화)
- [ ] T-43 하한가 알림 / 멀티 브라우저 / 메뉴바 위젯 커스텀

## 롤백 계획

- 코드: `git revert` / `git reset`
- 앱: `killall ShopWiseBar`, `rm -rf ~/Applications/ShopWiseBar.app`
- 저장소: SwiftData 파일 삭제 (앱 데이터 초기화)
- 배포: 이전 버전 .app 재설치
