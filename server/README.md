# ShopWiseBar Server (똑바 중앙 서버)

중앙 상품 DB + 가격 이력 + 관심 상품 알림 API (v0.3 — 익스텐션 연동).

## 실행

```bash
cd server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000        # 서버 (개발: --reload)
.venv/bin/python -m crawlers.worker      # 올리브영 크롤러 워커 (별도 프로세스)
```

- Swagger: http://127.0.0.1:8000/docs
- 헬스체크: http://127.0.0.1:8000/health

## API (v1)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | /api/v1/devices | 익명 기기ID 발급 (익스텐션 최초 실행) |
| GET | /api/v1/products/{id}?device_id= | 상품 조회 (관심 여부 포함) |
| POST | /api/v1/products | 상품 등록/업데이트 (upsert) |
| POST | /api/v1/products/{id}/prices | 가격 업로드 (source: crawler/extension/client) |
| GET | /api/v1/products/{id}/prices | 가격 이력 (그래프용) |
| PUT | /api/v1/devices/{did}/watches/{pid} | 관심 등록 (목표가 선택) |
| DELETE | /api/v1/devices/{did}/watches/{pid} | 관심 해제 |
| GET | /api/v1/devices/{did}/watches | 관심 목록 |
| GET | /api/v1/devices/{did}/alerts?since= | 폴링 알림 (하락/목표가 도달) |

## 수집 우선순위 (v0.3 확정)

1. 서버 크롤러 — 올리브영만 (Playwright headless, 실측 성공)
2. 브라우저 익스텐션 — 네이버/쿠팡/올리브영 전부 (상품 페이지 방문 시 DOM 추출 → 업로드, source=extension)
3. (폐기) 맥 메뉴바 osascript — 2026-08-03 제거

- 네이버/쿠팡 서버 자동 수집 불가 실측 기록: `docs/tests/v0.3_crawler_poc.md` (캡차/Akamai)

## 규약

- product_id: `coupang 상품번호` / `store:{store}:{id}` / `brand:{store}:{id}` / `c:{id}` / `goodsNo` / `oyrun:{url}`
- 에러: `E-SRV-{CAT}-NNNN` 체계
- DB: SQLite `shopwisebar.db` (PostgreSQL 전환 시 alembic 적용 예정)
