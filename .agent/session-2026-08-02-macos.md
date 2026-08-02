# 세션 — 2026-08-02 (macOS) — P5 중앙 서버 핵심 완성 (T-50~54) → 실기기 검증 대기

## 6줄 요약

1. **무엇을**: 다중 사용자 중앙 서버형 전환 완료 — 서버 API 7종 + 클라이언트 연동(기기ID/캐치→서버 조회→관심 자동 팝오버) + 알림 폴링(60초) + 하이브리드 가격 업로드. **P5 핵심 체인 전부 구현+검증**
2. **플랫폼**: macos 클라이언트 + server/ (Python FastAPI, SQLite) — 전체 검증: 기기ID 200, price_dropped 알림 반환, 폴링 GET /alerts 주기 동작
3. **빌드 결과**: 커밋 17개 (P0~P2 11 + e05c679 docs통합 + 651ae6d 서버 + 088645d T-53 + 41d86e9 T-54 + c460f1f 업로드). 빌드 성공
4. **PERF**: 해당 없음. 주의: 업로드 fire-and-forget Task 다수 — 서버 다운 시 WARN 로그만, 로컬 동작 무영향
5. **남은 TODO**: ①실기기 검증: 브라우저에서 관심 상품 열면 자동 팝오버 ②알림 수신 확인 ③T-56 배포(Docker) ④T-55 크롤러 — 올리브영 403 실측(TLS 스택 차단) → Playwright 검토 보류 ⑤알림 권한(개발자 서명) ⑥카탈로그 c: URL 대기
6. **다음 에이전트 전달**: ①서버 실행: `server/.venv/bin/uvicorn app.main:app --port 8000` (현재 실행 중, 로그 /tmp/swb_server.log) ②검증 방법: `sqlite3 server/shopwisebar.db "select id from devices limit 1"` → curl로 시나리오 재현 ③실기기 자동 팝오버 테스트: `PUT /api/v1/devices/{did}/watches/{pid}` 관심 등록 후 Chrome에서 해당 상품 열기 ④알림 폴링 첫 폴링은 since=now (과거 이력 스킵) ⑤알림 클릭 → userInfo product_id → autoShowPopover ⑥크롤러: server/crawlers/ (oliveyoung HTTP — 403 실측), run_crawler.py로 실행 ⑦세션 끊김: IP 변경으로 개선됨 (이번 세션은 안정) ⑧에러코드: E-MAC-NET-2001~2003 추가됨 (error_message_ko.json 갱신 완료)

## 커밋 상태

- P0~P2 11개 + `e05c679`(docs 통합) + `651ae6d`(서버 스켈레톤) + `088645d`(T-53 연동) + `41d86e9`(T-54 알림 폴링) + `c460f1f`(하이브리드 업로드 + 크롤러 403 기록) — 전부 커밋 완료
- 서버 실행 중 (uvicorn :8000), 테스트 DB: server/shopwisebar.db
