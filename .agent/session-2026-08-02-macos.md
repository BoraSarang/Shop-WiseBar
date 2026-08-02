# 세션 — 2026-08-02 (macOS) — 방향 전환: 로컬 → 클라이언트-서버 (중앙 상품 DB)

## 6줄 요약

1. **무엇을**: 사용자 요구 확인 — 이 프로젝트는 개인용이 아니라 **배포용 다중 사용자 프로그램**. 최종 목표 = 중앙 상품 DB + 자동 크롤링 + 관심 상품 메뉴바 자동 표시 + 알림 (Fallcent를 메뉴바 앱으로)
2. **플랫폼**: macos 클라이언트 + **서버 신규 (Python FastAPI)** — 기존 P0~P2 코드는 클라이언트로 재사용 (브라우저 캐치/파서/가격 추출/UI 유지)
3. **빌드 결과**: PRD v0.2 + PLAN P5(T-50~56) + **server/ FastAPI 스켈레톤 완성 + 스모크 테스트 전부 통과** (기기ID/상품등록/가격업로드/관심등록/알림폴링/가격이력 7종). 미커밋 상태 (사용자 확인 대기)
4. **PERF**: 해당 없음 (서버 작업). 참고: Python 3.14에서 pydantic-core 빌드 실패 → 최소 버전(pydantic>=2.12)으로 해결
5. **남은 TODO**: T-53 클라이언트 연동(BrowserMonitor 캐치→서버 조회→관심 상품 자동 팝오버), T-54 알림 폴링(클라이언트), T-55 크롤러 워커, T-56 배포(Docker), 커밋
6. **다음 에이전트 전달**: ①서버 실행: `server/.venv/bin/uvicorn app.main:app --port 8000` (스모크 테스트: POST /devices → POST /products → POST /prices → PUT watches → GET alerts) ②product_id 규약은 클라이언트 MallParser와 동일 ③알림 로직: since 이후 가격 ≤ 목표가(target_reached) 또는 이전 대비 하락(price_dropped) ④테스트 시 DB 초기화: `rm server/shopwisebar.db` ⑤미커밋 파일: docs/PRD.md, docs/PLAN.md, .gitignore, .agent/session, server/, docs/ (문서 이동) ⑥커밋 타입은 `feat(server)` / `docs: 문서 docs/ 통합 (v1.10 표준)` ⑦세션 끊김 잦음 — 작업 후 즉시 세션 로그 저장 ⑧공통 AGENTS.md v1.10.0 — 문서는 전부 docs/, error_message_ko.json만 앱 리소스로 루트 유지
3. **빌드 결과**: 기존 커밋 11개 유지 (4488e5d~5aafbfe). 방향 전환 후 첫 작업은 문서 전환 + 서버 스켈레톤
4. **PERF**: 해당 없음 (문서/서버 작업)
5. **남은 TODO**: PRD v0.2 수정, PLAN P5 추가, server/ FastAPI 스켈레톤, 클라이언트 연동 (BrowserMonitor → 서버 조회 → 관심 상품 자동 팝오버), 알림 폴링
6. **다음 에이전트 전달**: ①방향: 하이브리드 크롤링(클라이언트 브라우저 세션 업로드 + 서버 크롤러 보완), 클라이언트 폴링 알림, FastAPI, 익명 기기 ID ②Fallcent 벤치마크 확인 완료 (fallcent.com — 중앙 서버가 전체 쿠팡 크롤링, 회원가입 없음) ③네이버 서버 IP 크롤링 차단(429) 실측됨 — 서버 단독 크롤링 금지, 하이브리드 필수 ④기존 코드: BrowserMonitor 3초 폴링 → 캐치 시 서버 조회로 전환 예정 ⑤세션 끊김 이슈 있음 — 작업 후 즉시 세션 로그 저장 ⑥리부팅 후 재개 (2026-08-02 ~23시)

## 커밋 상태

- P0 `4488e5d` / P1 `a510798` / P2 수집 `7a73df1` / 쿠팡고정 `b0da605` / 모니터링 `73cab39` / 병렬화 `fcefbef` / docs `49609df` / 재시도 `33ba5d0` / 세션로그 `5aafbfe` — 커밋 완료
- **서버형 전환: 미커밋** — docs/PRD.md v0.2, docs/PLAN.md P5, .gitignore, server/ (스모크 테스트 통과) + 문서 docs/ 이동 (AGENTS.md v1.10 표준)

## 설계 결정 (2026-08-02 확정)

| 항목 | 결정 | 근거 |
|------|------|------|
| 데이터 수집 | 하이브리드 (클라이언트 업로드 + 서버 크롤러 보완) | 네이버 서버 IP 차단(429) 실측, 쿠팡 Akamai |
| 알림 | 클라이언트 폴링 (메뉴바 앱이 주기 조회 → 로컬 알림) | APNs 불필요, ad-hoc 서명 문제 회피 |
| 서버 스택 | Python FastAPI | 크롤링 생태계 |
| 계정 | 익명 기기 ID | Fallcent와 동일, 회원가입 장벽 제거 |
