# AGENTS.local.md — Shop WiseBar (똑바)

프로젝트 공통 특화 규칙. 상위 규칙은 `~/.config/opencode/AGENTS.md`(v1.9.0-common) 참조.

## 프로젝트 개요

- **제품명**: ShopWiseBar (영문) / 똑바 (한글) — 가격 변동 추적
- **플랫폼**: 중앙 서버(FastAPI + SQLite) + 브라우저 익스텐션(Chrome MV3) — 2026-08-03 맥 메뉴바 폐기
- **수집 우선순위**: ①서버 크롤러(올리브영 Playwright) ②익스텐션(네이버/쿠팡/올리브영) ③(폐기) 맥 메뉴바
- **벤치마크**: 폴센트(fallcent.com) — 가격 변동 추적 + 알림 + 통계
- **에러코드**: `E-SRV-{CAT}-NNNN`(서버) / `E-EXT-{CAT}-NNNN`(익스텐션) — 매핑은 루트 `error_message_ko.json`

## 서버 실행 (필수)

```bash
cd server && .venv/bin/uvicorn app.main:app --port 8000   # 로컬 서버
```

- 가상환경: `server/.venv` (playwright 설치됨, `channel="chrome"` 사용 — chromium 다운로드 타임아웃 이슈)
- DB: `server/shopwisebar.db` (SQLite, 커밋 금지)
- API 명세: `server/app/routers/` — Swagger: http://127.0.0.1:8000/docs

## 익스텐션 로드 (개발자 모드)

1. Chrome → `chrome://extensions` → 개발자 모드 ON → "압축해제된 확장 프로그램을 로드합니다" → `extension/` 선택
2. 수정 후 페이지 새로고침 (background는 서비스 워커 — 변경 시 확장 재로드)
3. 검증: 서버 DB에서 `price_points` 기록 확인 (`source=extension`)
4. 서버 URL 기본값: `http://127.0.0.1:8000` (추후 클라우드)

## 검증 워크플로우

1. 코드 수정 → 2. 익스텐션 재로드 → 3. 상품 페이지 방문 → 4. 서버 DB/로그로 수집 확인 → 5. 팝업/알림 동작 확인 → 6. DoD 체크

## 규칙 요약

- 모델 고정: `docs/AI_MODELS.json` 준수
- 네이버/쿠팡: 서버 자동 수집 불가(실측 — 캡차/Akamai) — 익스텐션 경유만
- 올리브영: 서버 Playwright 크롤러(`server/crawlers/`) 사용, `channel="chrome"`
- 쿠팡 가격: `%` 인접 숫자 패턴 (직접 추출 시 body 텍스트 정규식)
- 시크릿: 하드코딩 금지, `.env`/`env-expiry-check.sh` 준수
- 크로스플랫폼 프레임워크(Flutter/KMP/RN) 추가 금지
- 커밋: `type(extension|server): subject` 예) `feat(extension): capture product price`
- 파괴 금지: DB 마이그레이션은 up/down 분리, `.env` 삭제 금지

## 참고 문서

- 기능 정의: `docs/PRD.md` / 기술 설계: `docs/DESIGN.md` / 로드맵: `docs/PLAN.md` / 작업 추적: `docs/TODO.md`
- 맥 메뉴바 레거시: git 히스토리만 보존 (v0.2.x)
