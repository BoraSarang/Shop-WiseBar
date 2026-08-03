# PLAN — Shop WiseBar (똑바)

상태: `[x]` 완료 / `[ ]` 대기 · 최종 업데이트: 2026-08-02 (v0.2 — 클라이언트-서버 전환)

> **방향 전환 (2026-08-02)**: 개인용 → **다중 사용자 서비스형**. 중앙 상품 DB + 자동 크롤링 + 관심 상품 메뉴바 자동 표시 + 알림이 최종 목표. PRD v0.2 참조. 기존 P0~P2는 클라이언트로 재사용.

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

## P5 — 중앙 서버 (v0.2 신규 — 우선순위 1)

- [ ] T-50 서버 스켈레톤 (FastAPI + SQLite→PostgreSQL, 구조: models/routers/services/crawlers)
- [ ] T-51 상품/가격 이력/사용자(익명 기기ID) 모델 + DB 마이그레이션
- [ ] T-52 REST API: 상품 조회/등록, 가격 업로드, 가격 이력, 관심 상품 CRUD
- [ ] T-53 클라이언트 연동: 기기ID 발급 + 브라우저 캐치 → 서버 조회 → 관심 상품 자동 팝오버
- [ ] T-54 알림 폴링 API: 관심 상품 상태 변화 조회 (하락/목표가 도달) → 로컬 알림
- [ ] T-55 서버 크롤러 워커 — **실측 결론: 올리브영도 서버 HTTP 차단(403, TLS 스택 기반)**. Playwright 헤드리스 검토로 보류, 클라이언트 업로드가 주축 (T-53 완료)
- [ ] T-56 배포 준비 (Docker/호스팅, .env.example, 로컬 실행 스크립트)
- [x] T-57 메뉴바 팝오버 2모드 재설계 (2026-08-03 완료 — 실기기 검증): 캐치 모드(상품 정보 + 기간별 가격 추이[7일/1개월/전체] + 최저/최고/평균 + 현재 최저가 판정 + 절약액 + 추적 시작/찜됨) / 홈 모드(마지막에 본 상품 + 찜 목록 진입) / 찜 목록 모드(기존 관리 화면) — 참고: pricearchive.org, AiPrice, AliHelper
- [ ] T-58 서버 추천 리스트 API (베스트/최신 할인 — 데이터 축적 후), 구매 추천가/가짜 할인 판정

## 롤백 계획

- 코드: `git revert` / `git reset`
- 앱: `killall ShopWiseBar`, `rm -rf ~/Applications/ShopWiseBar.app`
- 저장소: SwiftData 파일 삭제 (앱 데이터 초기화)
- 서버: `docker compose down`, DB 볼륨 삭제
- 배포: 이전 버전 .app 재설치
