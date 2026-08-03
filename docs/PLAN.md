# 똑바(Shop WiseBar) 구현 계획 — v0.3.0

> 2026-08-03 재구성: 맥 메뉴바 폐기 → 중앙 서버 + 익스텐션. 기존 서버(server/)는 재사용, 맥 앱 코드는 git 히스토리로만 보존.

## Phase 0 — 재구성 기반 (완료 2026-08-03)
- [x] 맥 앱 코드/프로젝트 제거 (ShopWiseBar/, xcodeproj, project.yml, build_and_run.sh)
- [x] docs 전면 재작성 (PRD/DESIGN/PLAN/TODO/CHANGELOG)
- [ ] AGENTS.local.md 갱신 (macos 플랫폼 제거, extension 추가)
- [ ] error_message_ko.json 에러코드 재체계 (E-EXT-/E-SRV-)

## Phase 1 — 익스텐션 뼈대 (T-60)
- [ ] manifest.json (MV3, 권한, host_permissions)
- [ ] background.js: 기기ID 발급/등록
- [ ] MallParser JS 포팅 (URL → mall + productID)
- [ ] content.js: DOM 가격/제목/이미지 추출 (네이버/쿠팡/올리브영)
- [ ] 탭 이벤트 → 수집 → 서버 업로드 (중복 억제 10분)
- [ ] 실기기(개발자 모드) 검증: 서버 DB에 price_points 기록 확인

## Phase 2 — 팝업 UI (T-61)
- [ ] popup: 찜 목록 (추가/해제/목표가 설정)
- [ ] popup: 가격 추이 그래프 (캔버스)
- [ ] popup: 최근 알림 목록
- [ ] 서버 watches API 연동 확인

## Phase 3 — 알림 (T-62)
- [ ] chrome.alarms 주기 폴링 (5분)
- [ ] chrome.notifications (PRICE_DROP / TARGET_REACHED)
- [ ] 알림 클릭 → 상품 페이지 오픈
- [ ] 중복 방지 (since 커서)

## Phase 4 — 서버 (T-63)
- [ ] price_points.source에 "extension" 값 허용 확인 (스키마 기존: String(16) OK)
- [ ] 올리브영 크롤러 Playwright 전환 (PoC 실측 코드 기반)
- [ ] 크롤러 워커 주기 실행 검증

## Phase 5 — 마무리 (T-64)
- [ ] Edge/Whale manifest 호환 확인
- [ ] 옵션 페이지 (서버 URL, 알림 주기) — 최소
- [ ] 테스트 기록 docs/tests/v0.3_extension.md
- [ ] CHANGELOG/TODO 갱신 + 커밋

## 테스트 계획 (TC 번호)

| TC | 내용 | 디바이스 |
|----|------|----------|
| TC-01 | 네이버 스마트스토어 상품 페이지 방문 → 서버에 price 기록 | Chrome macOS |
| TC-02 | 쿠팡 상품 페이지 방문 → 수집 | Chrome |
| TC-03 | 올리브영 상품 페이지 방문 → 수집 | Chrome |
| TC-04 | 같은 상품 재방문 10분 내 → 중복 수집 없음 | Chrome |
| TC-05 | 찜 추가/해제/목표가 설정 → 서버 반영 | Chrome |
| TC-06 | 가격 하락 시 브라우저 알림 표시 | Chrome |
| TC-07 | 목표가 도달 시 브라우저 알림 표시 | Chrome |
| TC-08 | 올리브영 서버 크롤러 1회 수집 성공 (Playwright) | 서버 |
| TC-09 | 서버 다운 시 익스텐션 에러 무해 처리 | Chrome |

## 롤백 계획

- 익스텐션 문제 시: 개발자 모드 로드 해제 = 즉시 무력화 (서버 데이터 영향 없음)
- 서버 문제 시: `git revert` + 기존 DB 백업 (server/shopwisebar.db)
- 크롤러 문제 시: worker 중단 (서버 API 동작 무관)
