# products 라우터 테스트 — upsert / 가격 업로드 dedup / stats / sold-out / prices 삭제
# PLATFORM: server (pytest)
import pytest


@pytest.fixture
def product_payload():
    return {
        "product_id": "test:product:1",
        "mall": "naver",
        "url": "https://smartstore.naver.com/test/products/1",
        "name": "테스트 상품",
        "source": "detail",
    }


class TestProducts:
    def test_upsert_and_get(self, client, product_payload):
        r = client.post("/api/v1/products", json=product_payload)
        assert r.status_code == 201
        body = r.json()
        assert body["product_id"] == "test:product:1"
        assert body["name"] == "테스트 상품"

        g = client.get("/api/v1/products/test%3Aproduct%3A1")
        assert g.status_code == 200
        data = g.json()
        assert data["name"] == "테스트 상품"
        assert data["last_price"] is None

    def test_upsert_updates_name_on_detail_source(self, client, product_payload):
        client.post("/api/v1/products", json=product_payload)
        # detail 소스 — 이름 항상 갱신
        payload = {**product_payload, "name": "갱신된 이름"}
        client.post("/api/v1/products", json=payload)
        g = client.get("/api/v1/products/test%3Aproduct%3A1").json()
        assert g["name"] == "갱신된 이름"

    def test_get_404_unknown_product(self, client):
        r = client.get("/api/v1/products/no-such-id")
        assert r.status_code == 404
        assert r.json()["detail"]["code"] == "E-SRV-DB-1001"


class TestPriceUpload:
    def test_upload_and_last_price(self, client, product_payload):
        client.post("/api/v1/products", json=product_payload)
        r = client.post(
            "/api/v1/products/test%3Aproduct%3A1/prices",
            json={"price": 10000, "source": "extension"},
        )
        assert r.status_code == 201
        g = client.get("/api/v1/products/test%3Aproduct%3A1").json()
        assert g["last_price"] == 10000
        assert g["min_price"] == 10000
        assert g["avg_price"] == 10000
        assert g["price_count"] == 1

    def test_dedup_same_price_no_new_point(self, client, product_payload):
        client.post("/api/v1/products", json=product_payload)
        client.post("/api/v1/products/test%3Aproduct%3A1/prices", json={"price": 10000})
        client.post("/api/v1/products/test%3Aproduct%3A1/prices", json={"price": 10000})
        g = client.get("/api/v1/products/test%3Aproduct%3A1").json()
        # dedup: 같은 가격은 로우 INSERT 생략 → price_count(로우 수) 1, 통계 point_count는 2
        assert g["price_count"] == 1

    def test_price_change_records_new_point(self, client, product_payload):
        client.post("/api/v1/products", json=product_payload)
        client.post("/api/v1/products/test%3Aproduct%3A1/prices", json={"price": 10000})
        client.post("/api/v1/products/test%3Aproduct%3A1/prices", json={"price": 9000})
        g = client.get("/api/v1/products/test%3Aproduct%3A1").json()
        assert g["last_price"] == 9000
        assert g["min_price"] == 9000
        assert g["price_count"] == 2
        prices = client.get("/api/v1/products/test%3Aproduct%3A1/prices").json()
        assert [p["price"] for p in prices] == [10000, 9000]  # 시간 오름차순

    def test_variant_isolated_stats(self, client, product_payload):
        payload = {**product_payload, "product_id": "test:variant:1", "mall": "coupang"}
        client.post("/api/v1/products", json=payload)
        client.post("/api/v1/products/test%3Avariant%3A1/prices", json={"price": 10000, "variant": "a"})
        client.post("/api/v1/products/test%3Avariant%3A1/prices", json={"price": 9000, "variant": "b"})
        g = client.get("/api/v1/products/test%3Avariant%3A1").json()
        # variant 미지정 전체 — a와 b 혼합
        assert g["last_price"] == 9000
        assert g["min_price"] == 9000

    def test_upload_404(self, client):
        r = client.post("/api/v1/products/nope/prices", json={"price": 100})
        assert r.status_code == 404

    def test_upload_with_captured_at_past(self, client, product_payload):
        # v0.10.7 (T-96a): captured_at 지정 시 과거 시점 가격으로 저장 — 데모 시딩용
        from datetime import datetime, timedelta, timezone

        client.post("/api/v1/products", json=product_payload)
        past = (datetime.now(timezone.utc) - timedelta(days=15)).strftime("%Y-%m-%dT%H:%M:%SZ")
        r = client.post(
            "/api/v1/products/test%3Aproduct%3A1/prices",
            json={"price": 10000, "captured_at": past},
        )
        assert r.status_code == 201
        assert r.json()["captured_at"] is not None
        prices = client.get("/api/v1/products/test%3Aproduct%3A1/prices").json()
        assert prices[0]["price"] == 10000
        # 저장된 captured_at이 과거 시점인지 확인 (오늘과 다름)
        assert prices[0]["captured_at"].startswith(past[:10])

    def test_upload_without_captured_at_now(self, client, product_payload):
        # captured_at 미지정이면 기존 동작 그대로 (now)
        from datetime import datetime, timezone

        client.post("/api/v1/products", json=product_payload)
        before = datetime.now(timezone.utc)
        r = client.post("/api/v1/products/test%3Aproduct%3A1/prices", json={"price": 10000})
        assert r.status_code == 201
        saved = r.json()["captured_at"]
        assert saved is not None
        # 응답 시각이 now와 1분 이내 — 과거 시점 아님을 확인
        from datetime import datetime as dt

        saved_dt = dt.fromisoformat(saved.replace("Z", "+00:00"))
        assert (saved_dt - before).total_seconds() < 60


class TestStats:
    def test_stats_empty(self, client, product_payload):
        client.post("/api/v1/products", json=product_payload)
        s = client.get("/api/v1/products/test%3Aproduct%3A1/stats").json()
        assert s["period7"]["min"] is None
        assert s["overall"]["min"] is None

    def test_stats_reflects_uploads(self, client, product_payload):
        client.post("/api/v1/products", json=product_payload)
        client.post("/api/v1/products/test%3Aproduct%3A1/prices", json={"price": 10000})
        client.post("/api/v1/products/test%3Aproduct%3A1/prices", json={"price": 9000})
        s = client.get("/api/v1/products/test%3Aproduct%3A1/stats").json()
        assert s["period7"]["min"] == 9000
        assert s["overall"]["min"] == 9000
        assert s["overall"]["avg"] == 9000  # 일별 low_price 평균 — 10000/9000 같은 날이면 저가 9000

    def test_stats_404(self, client):
        assert client.get("/api/v1/products/unknown/stats").status_code == 404


class TestSoldOut:
    def test_sold_out_cycle(self, client, product_payload):
        client.post("/api/v1/products", json=product_payload)
        r = client.post(
            "/api/v1/products/test%3Aproduct%3A1/sold-out", json={"sold_out": True}
        )
        assert r.status_code == 200
        assert r.json()["sold_out"] is True
        g = client.get("/api/v1/products/test%3Aproduct%3A1").json()
        assert g["sold_out"] is True
        # 가격 업로드 = 재판매 → 품절 자동 해제
        client.post("/api/v1/products/test%3Aproduct%3A1/prices", json={"price": 8000})
        g = client.get("/api/v1/products/test%3Aproduct%3A1").json()
        assert g["sold_out"] is False


class TestDeletePrice:
    def test_delete_price_and_recover_last(self, client, product_payload):
        client.post("/api/v1/products", json=product_payload)
        client.post("/api/v1/products/test%3Aproduct%3A1/prices", json={"price": 10000})
        client.post("/api/v1/products/test%3Aproduct%3A1/prices", json={"price": 9000})
        r = client.delete("/api/v1/products/test%3Aproduct%3A1/prices/9000")
        assert r.status_code == 200
        assert r.json()["deleted"] == 1
        g = client.get("/api/v1/products/test%3Aproduct%3A1").json()
        assert g["last_price"] == 10000  # 삭제값이 last였다면 최근 남은 값으로 복구
