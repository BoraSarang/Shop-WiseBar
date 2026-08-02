# TODO — Shop WiseBar (똑바)

업데이트: 2026-08-02

## 진행 중 (P0)

- [x] 문서 정리 완료 (PRD/DESIGN/PLAN/TODO/CHANGELOG/AGENTS 확장/AI_MODELS/error_message_ko)
- [x] 표준 스크립트 작성 (build_and_run.sh + scripts 3종)
- [x] Xcode 프로젝트 생성 + 빌드 검증 (build_and_run.sh debug macos)
- [x] git init + .gitignore + PR 템플릿
- [x] **P0 직접 테스트 완료** (docs/tests/v0.1.0_macos.md, TC-01~TC-11, 스크린샷 4종)
- [ ] Cmd+D 단축키 수동 확인 (앱 활성 상태에서 — 자동화 제약)
- [ ] 웨일(Whale) AppleScript 지원 실측 → P2-T22에서 진행

## 다음 (P1)

- [ ] 상품 모델 + SwiftData 저장소 (T-10)
- [ ] 몰 레지스트리 + URL 파서 (T-11)
- [ ] PriceFetcher (T-12)
- [ ] 백그라운드 갱신 스케줄러 (T-13)
- [ ] 알림 엔진 (T-14)
- [ ] 통계 + 그래프 (T-15)
- [ ] 메뉴바 팝오버 UI (T-16)

## 보류

- [ ] 쿠팡 파트너스 API 심사 (P4-T42)
- [ ] 익스텐션 검토 (P4-T41)

## 버그 큐

- bd CLI 사용: `bd list --label macos` / `bd create ... --label macos`
- 현재 등록 버그 없음
