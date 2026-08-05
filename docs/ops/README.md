# 서버 운영 가이드 (Render)

> 플랫폼: server · 마지막 갱신: 2026-08-06 (v0.10.3) · 배포 주소: https://shop-wisebar.onrender.com

## 1. 배포 (Deploy)

- **호스팅**: Render Web Service (무료 티어) — GitHub `BoraSarang/Shop-WiseBar` `main` 브랜치 자동 배포
- **서비스 디렉토리**: `server/`
- **빌드 명령**: `pip install -r requirements.txt`
- **시작 명령**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **환경변수** (Render Dashboard → Environment):
  | 변수 | 값 | 비고 |
  |------|-----|------|
  | `DATABASE_URL` | Neon PostgreSQL 연결 문자열 | 없으면 로컬 SQLite |
  | `CORS_ORIGINS` | `chrome-extension://... , https://borasarang.github.io` | 확장/랜딩 출처 |

> 배포 트리거: `main` 푸시 자동. 수동 배포: Render Dashboard → Manual Deploy.

## 2. 로그 보기

- **요청/에러 로그**: Render Dashboard → 서비스 → **Logs** 탭
  - 요청 로그: `req method=GET path=/health status=200 elapsed_ms=10.7`
  - 에러 로그: `unhandled error path=... exc=...` + Python 스택 (500 응답 + `E-SRV-GEN-1001`)
- 로깅은 표준출력(stdout)으로 출력 → Render가 수집

## 3. 상태 확인 (모니터링)

### /health
```bash
curl https://shop-wisebar.onrender.com/health
```
응답:
```json
{
  "status": "ok",
  "version": "0.2.0",
  "started_at": "2026-08-06T...Z",
  "db": {"ok": true, "error": null},
  "indexes": ["ix_price_points_prod_cap", "ix_price_daily_prod_date", "ix_product_relations_pair"]
}
```
- `status: "ok"` — 정상 / `"degraded"` — DB 연결 실패 (db.error에 원인)
- `indexes` — 스토리지 스타트업에 적용된 복합 인덱스 확인 (누락 시 빌드/시작 실패 의심)

### 슬립(무료 티어) 안내
- Render 무료 티어는 15분 무접속 시 잠들어, 첫 요청이 수 초 지연될 수 있음.
- 확장의 5분 알림 폴링(`alert-poll`)이 주기적으로 /api를 호출해 슬립을 방지.
- 외부 uptime 핑(Healthchecks.io 등)은 무료 티어 월 할당량 소진 위험이 있어 도입 보류.
  → 사용자 증가/유료 전환 시 검토.

## 4. DB 운영

- **DB**: Neon PostgreSQL (외부 서비스) — `DATABASE_URL`로 연결
- **인덱스/컬럼 마이그레이션**: 서버 시작 시 자동 적용
  - `INDEX_SQLS`(recommendations.py): price_points·price_daily_stats·product_relations 복합 인덱스
  - `_ensure_columns`(main.py): 신규 컬럼(ALTER TABLE IF NOT EXISTS)
- **스키마 대형 변경**: alembic 도입(T-51 보류) — 현재는 자동 마이그레이션에 의존

## 5. 장애 대응 체크리스트

| 증상 | 확인 | 조치 |
|------|------|------|
| 첫 요청 느림 | /health 응답시간 | 슬립 — 확장 폴링이 깨움, 문제 없음 |
| 500 응답 | Render Logs에 `unhandled error` | 스택 확인 → 에러코드(`E-SRV-GEN-1001`) → 수정 후 재배포 |
| db degraded | /health의 `db.error` | DATABASE_URL/Neon 상태 확인 |
| 인덱스 누락 | /health indexes | 스타트업 로그에 SQL 오류 없는지 확인 |
| 확장이 서버 접속 불가 | 확장 팝업 E-SRV-NET-1001 | Render 서비스 상태 확인 + 재배포 |

## 6. 유용 링크

- Render Dashboard: https://dashboard.render.com/
- Neon DB: https://console.neon.tech/
- 확장 서버 URL 설정: `extension/common.js`의 `SWB_CONFIG.server` (배포판 단일 관리)
