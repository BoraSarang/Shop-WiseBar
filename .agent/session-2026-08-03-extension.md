# 세션 로그 — 2026-08-03 (extension+server 재구성)

## 1. 무엇을
맥 메뉴바 앱 전면 폐기 → 중앙 서버 + 브라우저 익스텐션(Chrome MV3) 재구성. 수집 우선순위: ①서버 크롤러(올리브영 Playwright) ②익스텐션(전 몰).

## 2. 어떤 플랫폼
extension (Chrome MV3), server (FastAPI). 맥 앱 코드 전체 삭제.

## 3. 빌드/검증 결과
- JS 4개 파일 `node --check` 통과
- 올리브영 크롤러 실측: `fetch_goods("A000000171427")` → 39,900원 ✅ (기본 UA는 Cloudflare 차단, Chrome UA 필수)
- 서버 API E2E ✅: device → upsert → price(source=extension) → watch(목표가) → alerts price_dropped/target_reached + since 증분 폴링

## 4. PERF/성능
- 콘텐츠 스크립트: 1회 추출 ≤100ms 목표 (미측정 — 실기기 확인 필요)
- 크롤러: 1일 1회 배치 (worker 30분 주기, 배치 10건)

## 5. 남은 TODO
- T-60/61: Chrome 개발자 모드 로드 → 상품 페이지 방문 → 서버 DB price_points 확인 (사용자)
- T-64: Edge/Whale 로드 확인, 옵션 페이지(서버 URL) 보류, 커밋 후 docs/tests 갱신
- 추후: 클라우드 서버 배포(현재 127.0.0.1:8000 고정), 공식 API 조사(옵션 C)

## 6. 다음 에이전트 전달
- 익스텐션 로드: `chrome://extensions` → 개발자 모드 → `extension/` 로드. 서버 실행: `cd server && .venv/bin/uvicorn app.main:app --port 8000`
- background.js의 `CONFIG.server`가 서버 주소 (클라우드 전환 시 이 파일 + options 페이지 필요)
- content_scripts는 페이지 새로고침 시 주입 — 이미 열린 탭은 활성화 시 capture (onActivated)
- 에러코드: E-EXT-NET-1001(서버 연결) / E-EXT-URL-2001(지원 안 함) / E-SRV-* — error_message_ko.json 참조
- 테스트 상품/기기 E2E 데이터는 정리 완료 (DB 클린)
