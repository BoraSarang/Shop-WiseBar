# 서버 운영 가이드 (Render)

> 플랫폼: server · 마지막 갱신: 2026-08-10 (v0.16.7) · 배포 주소: https://shop-wisebar.onrender.com

## 1. 배포 (Deploy)

- **호스팅**: Render Web Service (무료 티어) — GitHub `BoraSarang/Shop-WiseBar` `main` 브랜치 자동 배포
- **러타임**: **Docker** (`server/Dockerfile`) + 배포 정의 `render.yaml` (v0.16.4, 블루프린트)
- **메모리 예산** (v0.16.5): Render 무료 티어 512MB 한도 — 크롤러는 ①배치 후 `close_browser()`로 크로미움 해제 ②컨텍스트에서 이미지/미디어/폰트/광고 요청 차단 ③배치 3건 제한. OOM("Ran out of memory") 재발 시 `/crawler/logs` 배치 소요+건수와 `[CRAWLER]` 진단 로그 확인.
- **Cloudflare 챌린지 대응** (v0.16.6): 운영 실측 로그 `og:title 없음 body=89자 (잠시만 기다려 주세요 ... RAY_ID)` = 올리브영이 Render 미국 DC IP + **Headless Shell** 봇을 차단한 것. Dockerfile에서 `playwright install chrome`(실제 Google Chrome)로 교체해 `channel="chrome"`으로 통과 확인(`브라우저: 시스템 Chrome`). 남은 0건은 **상품 소멸**(v0.16.7) — 로그의 `올리브영 소멸 상품(재시도 방지)` / `-> 소멸` 표시는 정상이며, 가격 없이 last_checked_at만 갱신해 무의미 재시도를 중단한다.
- **왜 Docker인가** (운영 실측 기록):
  - Render 컨테이너엔 시스템 Chrome 없음 → `channel="chrome"` launch 즉시 실패 → v0.16.2까지 크롤러 전수 실패(count=0·0.9s)
  - `pip`만으로는 playwright PyPI는 설치돼도 브라우저 이진파일/OS 의존성이 없음(0.16.3 배포 로그 실측)
  - NixPacks(runtime: python) 빌드는 **non-root** → `playwright install --with-deps`의 apt-get이 `su: Authentication failure`로 빌드 실패 (0.16.4 운영 실측)
  - Dockerfile은 루트로 빌드하므로 **apt-get(OS 의존성) + `python -m playwright install chromium`(번들 브라우저)**을 사전 설치 가능. 배포 시 `Dockerfile` 자동 사용.
- **적용 방법** (권장): Render Dashboard → **New + → Blueprint** → `render.yaml` 연결 → Apply.
  - 기존 Python Web Service가 있으면 블루프린트가 새 서비스로 생성되므로 **환경변수 재입력** 필요:
    - `DATABASE_URL` → 기존 값 그대로 복사 (Neon → Dashboard → Connection String)
    - `CORS_ORIGINS` → 기존/아래 값 유지
  - 적용 후 구 서비스는 비활성/삭제 (무료 티어 인스턴스 1개 제한 주의)
- **환경변수** (Render Dashboard → Environment):
  | 변수 | 값 | 비고 |
  |------|-----|------|
  | `DATABASE_URL` | Neon PostgreSQL 연결 문자열 | 없으면 로컬 SQLite fallback |
  | `CORS_ORIGINS` | `chrome-extension://... , https://borasarang.github.io` | 확장/랜딩 출처 |

> 배포 트리거: `main` 푸시 자동. 수동 배포: Render Dashboard → Manual Deploy.
> 크롤러 워커는 uvicorn과 동일 컨테이너에서 백그라운드로 실행 (`[CRAWLER]` 로그) — 서비스 추가 없이 운영.

## 2. 로그 보기

- **요청/에러 로그**: Render Dashboard → 서비스 → **Logs** 탭
  - 요청 로그: `req method=GET path=/health status=200 elapsed_ms=10.7`
  - 에러 로그: `unhandled error path=... exc=...` + Python 스택 (500 응답 + `E-SRV-GEN-1001`)
  - 크롤러 로그: `[CRAWLER] 배치 oliveyoung: 2건 수집 / 5건 시도 (70.7s)` — v0.16.2부터 시도/수집 표기. 브라우저 폴백 로그: `브라우저: 시스템 Chrome` / `브라우저: Playwright 번들 Chromium`
- 로깅은 표준출력(stdout)으로 출력 → Render가 수집

## 3. 크롤러 제어/모니터링 (v0.16.0)

```bash
# 설정 조회 (주기·활성화·트리거 대기·최근 실행)
curl https://shop-wisebar.onrender.com/api/v1/admin/crawler/config

# 주기 변경 (1/3/6/12/24시간, 실시간 반영)
curl -X PUT https://shop-wisebar.onrender.com/api/v1/admin/crawler/config \
  -H 'Content-Type: application/json' -d '{"interval_seconds":3600}'

# 활성화/비활성화
curl -X PUT https://shop-wisebar.onrender.com/api/v1/admin/crawler/config \
  -H 'Content-Type: application/json' -d '{"enabled":false}'

# 즉시 수집 (다음 틱 30초 내 1배치 = oliveyoung+naver)
curl -X POST https://shop-wisebar.onrender.com/api/v1/admin/crawler/run

# 배치 이력 (몰·성공/실패·건수·소요·트리거)
curl "https://shop-wisebar.onrender.com/api/v1/admin/crawler/logs?limit=50"
```

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
