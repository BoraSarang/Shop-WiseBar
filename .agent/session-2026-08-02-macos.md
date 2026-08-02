# 세션 — 2026-08-02 (macOS) — P1 가격 추적 MVP

## 6줄 요약

1. **무엇을**: P1 가격 추적 MVP 구현 — 몰 레지스트리/URL 파서, SwiftData 저장소, PriceFetcher, 갱신 스케줄러, 알림, 통계+Charts, 팝오버 상품 카드 UI, 우클릭 메뉴 실기능
2. **플랫폼**: macos (SwiftUI+AppKit, Charts.framework 추가, project.yml에 error_message_ko.json 리소스 등록)
3. **빌드 결과**: `./build_and_run.sh debug macos` 성공 (gitleaks/env-expiry 통과)
4. **PERF**: 갱신 366~707ms (병렬화 후), 단일 조회 471ms — 예산 내. 네이버 응답 지연 시 40초+ → 타임아웃 8/12초 + 몰 간 병렬로 해결
5. **남은 TODO**: 그래프 실데이터(가격 변동 대기), 알림 권한(ad-hoc 서명 → 개발자 서명 필요), 네이버/쿠팡 브라우저 세션(P2)
6. **다음 에이전트 전달**: ①네이버 HTTP 429 확정 → P2 브라우저 세션(m. 페이지 + `__PRELOADED_STATE__` + `:undefined→:null` 치환 + 가격은 body 텍스트) ②올리브영은 `salePrice\\":(\d+)` + og 태그 파싱 완전 동작 ③테스트 툴: `/tmp/popover_add`, `/tmp/menu_refresh`, `/tmp/wl4`, 로그 캡처 `script -q /dev/null ... > /tmp/swb_p4.log` ④에러코드: E-MAC-VALID-2003 추가됨 ⑤빌드 후 앱은 ~/Applications/ShopWiseBar.app (강제종료 시 pkill -9)

## 커밋 상태

- P0 커밋 완료: `feat(macos): P0 프로젝트 골격 + 자동화 테스트 [E-MAC-UI-6001]`
- P1 커밋 미완료 (변경 17파일 + 신규 12파일 대기)
