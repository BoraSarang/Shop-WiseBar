# 똑바(Shop WiseBar) v2.1 문서·규약 정비 계획 (chrome-server)

> 상위 공통 규칙이 v1.9 → **v2.1.0-common**으로 갱신(2026-08-04)됨에 따라, 이 프로젝트(Chrome 확장 + FastAPI 서버)에 해당하는 필수 문서/규약을 정비한다.
> v2.1의 모노레포/크로스브라우저(firefox/safari)는 이 프로젝트에 **미적용**(단일 확장+서버 구조 유지).

## 개요

- 플랫폼: chrome(Chrome MV3 확장) + server(FastAPI)
- 목적: AGENTS.md v2.1 준수 — 필수 문서(권한·메시지·API·AI_MODELS)와 PR 템플릿, 버전 참조를 최신 규약으로 갱신
- 적용 범위: 문서/규약만 (코드 동작 변경 없음)

## 결정 사항

1. 모노레포(pnpm+turbo) **미적용** — 단일 확장/서버 유지
2. 크로스브라우저(firefox/safari) **미적용** — Chrome MV3 단일
3. 오프라인 큐·AI 캐시는 LLM 미사용/서버 재시도 구조라 **P2 보류** (권한/메시지 문서에는 정책만 명시)
4. 스토어 심사 자동화는 docs 레벨 준비만 (P1 보류, 실제 등록은 후속)

## 구현 단계 (T-번호)

- T-76: `docs/AI_MODELS.json` → v2.1 스키마 갱신 (`language_lock`, `cache_policy`, `vision_support`)
- T-77: `AGENTS.local.md` 상위 버전 참조 → v2.1.0-common 수정
- T-78: `.github/pull_request_template.md` → ext/server 전용 템플릿 교체
- T-79: `docs/chrome/PERMISSIONS.md` 권한 정의서 생성
- T-80: `docs/chrome/MESSAGING.md` 메시지 규약 생성
- T-81: `docs/api/ENDPOINTS.md` 서버 API 명세 생성
- T-82: Chrome 디버그 모드(경량, 옵션 A) — `extension/debug.js` DebugLogger + 기존 console 교체 + 팝업 Debug 토글
- T-83: 전용 디버그 창(별도 popup 창) + 중앙 로그(`chrome.storage.local["debugLog"]`) + 다중 탭 로그 통일 (T-82 대체, v0.9.3)

## 테스트 계획 (TC)

- 문서 갱신이므로 동작 테스트 대상 없음. 렌더(마크다운) 확인 + `node --check`/파이썬 컴파일 불필요(코드 변경 없음).
- 검증: 생성 문서의 엔드포인트/권한이 실제 `manifest.json`,`server/app/routers/*`와 일치하는지 대조.
- T-82(디버그): `node --check`로 background/content/debug/popup 전부 통과 (2026-08-05). 로드 구조 확인 — manifest content_scripts `common.js→debug.js→content.js→swb-ui.js`, background `importScripts("common.js","debug.js")`, popup.html `debug.js`.

## 진행 기록

- 2026-08-04: T-76~81 문서 정비 완료, `docs/plans/PLAN_v2.1_chrome-server.md`·`docs/TODO.md` 갱신
- 2026-08-05: T-82 경량 디버그(옵션 A) 완료 — debug.js 신규, console.* 8곳 교체, EXTRACT `[PERF]`, 팝업 Debug 토글, manifest v0.9.3. TODO/CHANGELOG 반영
- 2026-08-05: **T-83 전용 디버그 창 + 중앙 로그 완료** — T-82(팝업 패널)는 SW 종료 시 로그 휘발 문제로 대체. `debug-view.html`(chrome.windows.create popup 창, 단축키 Ctrl+Shift+D), `debugLog` 중앙 storage, content→background `DEBUG_LOG` 위임으로 다중 탭 태깅 통일. 아울러 서버 `POST /products` 500(name 512자 초과, Postgres 길이 제약) 수정. TODO/CHANGELOG/MESSAGING 반영

## 롤백 계획

- 문서만 변경 → `git revert` 또는 해당 파일 편집 취소 (코드/데이터 영향 없음)

## 성능 예산

- 해당 없음 (문서 정비)