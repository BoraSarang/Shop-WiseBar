# ShopWiseBar Server (똑바 중앙 서버)

중앙 상품 DB + 가격 이력 + 관심 상품 알림 API (v0.2).

## 실행

```bash
cd server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

- Swagger: http://localhost:8000/docs
- 헬스체크: http://localhost:8000/health

## API (v1)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | /api/v1/devices | 익명 기기ID 발급 |
| GET | /api/v1/products/{id}?device_id= | 상품 조회 (관심 여부 포함) |
| POST | /api/v1/products | 상품 등록/업데이트 (upsert) |
| POST | /api/v1/products/{id}/prices | 가격 업로드 (client/crawler) |
| GET | /api/v1/products/{id}/prices | 가격 이력 (그래프용) |
| PUT | /api/v1/devices/{did}/watches/{pid} | 관심 등록 (목표가 선택) |
| DELETE | /api/v1/devices/{did}/watches/{pid} | 관심 해제 |
| GET | /api/v1/devices/{did}/watches | 관심 목록 |
| GET | /api/v1/devices/{did}/alerts?since= | 폴링 알림 (하락/목표가) |

## 규약

- product_id는 클라이언트 MallParser와 동일: `coupang 상품번호` / `store:{store}:{id}` / `brand:{store}:{id}` / `c:{id}` / `goodsNo` / `oyrun:{url}`
- 수집 방식: 하이브리드 — 클라이언트 브라우저 세션 업로드(source=client) + 서버 크롤러(source=crawler)
- 에러: `E-SRV-{CAT}-NNNN` 체계
