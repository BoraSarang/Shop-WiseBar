# 세션 로그 — 2026-08-11 (v0.16.13→v0.16.14, server · browserless + 네이버 0건 수정)

1. **무엇을**: T-124 — 크롤러 Chrome을 Browserless 클라우드로 이전. 후속 T-125 — 재개 검증 중 **네이버 brand 상품 0건 버그 + Browserless 컨텍스트 레이스** 수정.
2. **플랫폼**: server (크롤러). Browserless 공유 클라우드 `production-sfo.browserless.io` (path D: 기존 Playwright 재포인팅).
3. **빌드/PERF**: 
   - Browserless 토큰 설정: oliveyoung 2건 수집(31~36s, stealth 챌린지 우회) 성공 → **2차 배치부터 `Failed to open a new tab`/TargetClosedError** (무료 티어 세션·새 탭 쿼터 확인).
   - token 미설정 폴백(시스템 Chrome): **oliveyoung 2건 + 네이버 3건(199000·7900·79900원) 전부 수집 (33.7s)** — 네이버 0건 버그 해결 확정.
4. **남은 TODO**: T-125d — 상시 재개 보류. 재개 시 ①로컬 macOS 크롤러(무료, token 미설정) ②Browserless 유료 플랜 중 선택. Render 배포(web) 완료 후 `/health` 확인.
5. **다음 에이전트 전달**: 
   - 네이버 0건 원인 = candidates 30을 smartstore null 상품이 점유해 `brand.naver.com` 상품이 후보에서 영원히 밀림 → 쿼리 레벨 URL 필터로 해결 (`naver.py`).
   - Browserless CDP는 상품별 `new_context()`+close 금지 → `contexts[0]` 재사용 + `close_context()` 분기 (`_browser.py`).
   - token 값은 `.env`(server/, gitignore)에만 — 커밋·로그·스크린샷 노출 절대 금지. stealth 경로 `/chromium/stealth`가 챌린지 우회에 필수.
6. **문서**: PLAN_v0.16.13_browserless.md(갱신), CHANGELOG v0.16.14, TODO T-125, session 로그.
7. **오프라인 큐**: 해당 없음 (배치는 enabled=false 정지 상태 유지 — 상시 재개 보류).
8. **E2E/검증**: TC-0.16.13-1/2 통과. 네이버 브랜드 상품 수집 최초 성공(3건). Browserless 무료 티어 세션 쿼터 한계 실측 → 상시 운영 설계 변경 필요.