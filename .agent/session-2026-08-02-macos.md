# 세션 — 2026-08-02 (macOS) — 클라이언트-서버 연동 완료 (T-53) → T-54 알림 폴링 진행 중

## 6줄 요약

1. **무엇을**: 방향 전환 확정 (개인용 → 다중 사용자 중앙 서버형) 후 **T-53 클라이언트 연동 완료** — ServerClient(API 레이어) + 익명 기기ID 발급 + BrowserMonitor 캐치→서버 조회→관심 상품 메뉴바 자동 팝오버
2. **플랫폼**: macos 클라이언트 + server/ (Python FastAPI) — 빌드 성공, **기기ID 발급 실동작 검증 완료** (POST /api/v1/devices → 200 OK)
3. **빌드 결과**: 커밋 `651ae6d`(서버 스켈레톤), `e05c679`(문서 docs/ 통합). T-53 작업 미커밋 (ServerClient 등 9파일) — 커밋 대기
4. **PERF**: 해당 없음. 참고: Python 3.14 pydantic-core 빌드 실패 → `pydantic>=2.12` 최소 버전으로 해결
5. **남은 TODO**: T-53 커밋, T-54 알림 폴링(클라이언트 — 수 분 주기 GET /alerts → 로컬 알림), T-55 서버 크롤러 워커, T-56 배포(Docker), 관심 상품 자동 팝오버 실기기 검증(브라우저에서 관심 상품 열기)
6. **다음 에이전트 전달**: ①서버 실행: `server/.venv/bin/uvicorn app.main:app --port 8000` (현재 실행 중) ②기기ID는 UserDefaults `serverDeviceID`에 저장, baseURL은 DEBUG에서 `defaults write com.borasarang.ShopWiseBar ServerBaseURL -string http://127.0.0.1:8000` ③클라이언트 구현: ShopWiseBar/Networking/ServerClient.swift (getProduct/upsertProduct/uploadPrice/addWatch/removeWatch/getAlerts) ④BrowserMonitor.updateSuggestion이 async로 전환 — 서버 is_watched=true면 PopoverState.autoShowProductID + MenuBarController.autoShowPopover() ⑤PopoverRootView에서 autoShowProductID 카드 6초 하이라이트 ⑥자동 팝오버 실검증 방법: 서버에서 관심 등록(PUT watches) 후 Chrome에서 해당 상품 열기 ⑦세션 끊김 잦음(IP 변경으로 개선 시도 중) — 작업 후 즉시 세션 로그 저장 ⑧공통 AGENTS.md v1.10 — 문서는 전부 docs/, error_message_ko.json만 앱 리소스 루트

## 커밋 상태

- P0~P2 11개 (4488e5d~5aafbfe) + `e05c679`(docs 통합) + `651ae6d`(server 스켈레톤) — 커밋 완료
- **T-53 미커밋**: ServerClient.swift(신규), AppError.swift, error_message_ko.json, BrowserMonitor.swift, PopoverState.swift, MenuBarController.swift, PopoverRootView.swift, ShopWiseBarApp.swift, pbxproj(xcodegen)
