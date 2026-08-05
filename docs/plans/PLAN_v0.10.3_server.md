# PLAN v0.10.3_server — 서버 운영 개선 + 성능 최적화 (T-91, T-92)

> 상태: ✅ 완료 (2026-08-06). T-91(운영) + T-92(성능) 모두 반영, pytest 24건 통과.
> 세션 단절 대비: 이 문서가 먼저, 코드는 그 다음.

## 1. 개요

배포 서버(shop-wisebar.onrender.com)가 동작 중이지만 **막 운영 상태**다:
에러 로그가 남지 않고, 무료 티어 슬립으로 첫 요청이 느리고, 운영 DB에 새 인덱스가
적용됐는지도 확인하지 못했다. 이번 회차로 "에러를 남기고, 항상 깨어 있고, 느린 부분을
찾아 고치는" 상태로 만든다.

## 2. 현재 상태 (2026-08-05 확인)

- **로깅**: 없음 — main.py에 로거 없음, 라우터도 print 없음, 500은 FastAPI 기본 처리
- **/health**: `{"status":"ok","version":"0.2.0"}`만 — DB 연결 확인 없음
- **슬립**: Render 무료 티어 — 15분 무접속 시 잠들어 첫 요청 수 초 지연
- **DB 인덱스**: INDEX_SQLS 3개(price_points, price_daily_stats, product_relations)가
  스타트업에 적용되지만 실제 배포 DB 확인 불가 (로컬 SQLite로만 테스트)
- **성능 백로그**: 알림 폴링(devices/{id}/alerts)과 추천(recommendations) 쿼리가
  전체 데이터에서 조회 — p95 300ms 예산 대비 검증 없음

## 3. 결정 사항

### T-91 서버 운영 (①)
1. **구조적 로깅** — Python `logging` + 요청 미들웨어(메서드/경로/상태/소요ms) + 예외 핸들러
   (500 응답에 `E-SRV-GEN-1001` + 로그 스택) — Render 표준출력으로 수집
2. **/health 강화** — DB `SELECT 1` + `started_at` + `version` + `indexes` 상태 반환
3. **uptime 핑** — 외부 모니터(Healthchecks.io 등) 연동 대신, Render 웹 서비스는
   요청마다 깨어 있으므로 15분 이내 주기 폴링이면 충분 → **확장의 alert-poll(5분)이
   이미 핑 역할**. 다만 배포 직후 최초 기동 슬립 방지용으로 `/health`만의 단독 유지.
   (외부 핑 추가는 무료 티어 월 할당량 소진 위험 → 보류, `docs/ops/README.md`에 명시)
4. **운영 문서** — `docs/ops/` — 배포·모니터링·로그 보는 법 정리

### T-92 성능 백로그 (③)
1. **알림 폴링 쿼리 검증**: `GET /devices/{id}/alerts` — since 커서/인덱스 확인,
   불필요한 전체 조회 제거
2. **recommendations 인덱스 적용 확인**: 쿼리 EXPLAIN 또는 실행계획 확인
   (로컬 SQLite에 동일 스키마로 검증)
3. **로컬 부하 스모크**: pytest + 간단 응답시간 체크 (k6는 배포 서버 대상으로만)

## 4. 구현 단계

- [ ] T-91a: `app/logging_setup.py` — 로거 구성(포맷/핸들러) + 요청 미들웨어 + 예외 핸들러 + main.py 적용
- [ ] T-91b: `/health` 강화 — DB 체크 + started_at + version + indexes
- [ ] T-91c: `docs/ops/README.md` — 배포(Render)·로그 보기(Render Logs)·모니터링 방법
- [ ] T-92a: 알림 폴링 쿼리 점검 (since 커서 누락 여부, 인덱스)
- [ ] T-92b: recommendations 실행계획 로컬 검증 (인덱스 타는지)
- [ ] T-92c: pytest 전체 통과 + CHANGELOG + 커밋

## 5. 테스트 계획

| TC | 대상 | 검증 |
|----|------|------|
| TC-91-1 | 로깅 미들웨어 | 요청 → 로그 출력(메서드/경로/상태/ms), 500 시 스택 + E-SRV-GEN-1001 |
| TC-91-2 | /health | 200 + db:"ok" + started_at + version + indexes 목록 |
| TC-92-1 | alerts 쿼리 | since 주어졌을 때 이후만 조회 (N+1/전체 스캔 없는지) |
| TC-92-2 | recommendations | 인덱스 사용 확인 (SQLite EXPLAIN QUERY PLAN) |

## 6. 롤백 계획

- 로깅/health 변경은 무해 — git revert로 복원
- 알림 쿼리 변경은 동작에 영향 → 변경 전 응답 대조 후 배포

## 7. 성능 영향

- 로깅 미들웨어: 요청당 오버헤드 미미(ms 단위), 디버그 로그는 비활성
- 알림 쿼리 인덱스/커서: 조회 범위 축소 → 응답 개선

## 8. 에러코드

- E-SRV-GEN-1001: 처리되지 않은 서버 예외 (500) — `error_message_ko.json` 추가

## 9. DoD

- [ ] 로깅/health 동작 확인 (pytest)
- [ ] docs/ops/README.md 작성
- [ ] 알림/추천 쿼리 점검 결과 반영
- [ ] pytest 전체 통과 + CHANGELOG/TODO 반영
