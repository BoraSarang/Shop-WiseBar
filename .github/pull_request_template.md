## 변경 사항
- [ ] 플랫폼: extension (Chrome MV3) / server (FastAPI)
- [ ] 에러코드: E-EXT-... / E-SRV-...
- [ ] 문서 우선: docs/plans/PLAN_v{버전}_chrome-server.md 작성 여부
- [ ] 언어 준수: 모든 설명·추론·세션 로그 한국어

## 검증
- [ ] 확장: `node --check` 통과 + 개발자 모드 로드 정상
- [ ] 서버: `py_compile`/uvicorn 기동 + /health OK
- [ ] API E2E 로그 첨부 (device→upsert→price→watch→alerts)
- [ ] 실기기 확인 여부 (방문 수집·팝업·찜·알림)

## 성능/비용 영향
- 콘텐츠 스크립트 추출: _ms (예산 100ms)
- 알림 폴링: 5분 주기
- 서버: N+1 여부 / 인덱스

## 관련 bd
bd-