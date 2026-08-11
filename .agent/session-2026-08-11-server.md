# 세션 로그 — 2026-08-11 (v0.16.13, server · browserless)

1. **무엇을**: T-124 — 크롤러 Chrome을 Browserless 클라우드로 이전 (Render 512MB OOM/재시작 루프 근본 해결).
2. **플랫폼**: server (크롤러). Browserless 공유 클라우드 `production-sfo.browserless.io` (path D: 기존 Playwright 재포인팅).
3. **빌드/PERF**: 로컬 `--once` 실행 — oliveyoung 2건 수집(32.6s, **Browserless stealth**로 챌린지 우회), naver 0건, token 미설정 폴백 → 시스템 Chrome 정상. Render 컨테이너 메모리 부담 0 (Chrome 미실행).
4. **남은 TODO**: T-124e — Render web/worker 서비스 `Environment`에 `BROWSERLESS_TOKEN` 추가(대시보드, git 무노출). 완료 후 `crawler_config.enabled=true`로 배치 재개 가능.
5. **다음 에이전트 전달**: token 값은 `.env`(server/, gitignore)에만 — 커밋·로그·스크린샷 노출 절대 금지. stealth 경로 `/chromium/stealth`가 챌린지 우회에 필수 (non-stealth는 90자 챌린지 응답). `BROWSERLESS_HOST` 환경변수로 전용/자체 호스팅 변경 가능.
6. **문서**: PLAN_v0.16.13_browserless.md(신규), CHANGELOG v0.16.13, TODO T-124, ENDPOINTS(변경 없음 — 신규 API 없음).
7. **오프라인 큐**: 해당 없음 (배치는 enabled=false 정지 상태 유지).
8. **E2E/검증**: TC-0.16.13-1(로컬 Browserless 수집), TC-0.16.13-2(폴백 회귀) 통과. Render 배포 후 TC-0.16.13-3(/health <1s) 확인 대기.