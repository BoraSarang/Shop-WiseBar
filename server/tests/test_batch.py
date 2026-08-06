# batch 업로드 라우터 테스트 (v0.10.4, T-93) — 일괄 upsert + 가격 저장
# PLATFORM: server (pytest)
import pytest


def _item(pid, price=None, name=None):
    d = {"product_id": pid, "mall": "naver", "url": f"https://x/{pid}"}
    if name:
        d["name"] = name
    if price:
        d["price"] = price
    return d


class TestBatch:
    def test_batch_upsert_and_price(self, client):
        items = [_item(f"b:{i}", price=1000 + i, name=f"상품{i}") for i in range(3)]
        r = client.post("/api/v1/products/batch", json={"items": items})
        assert r.status_code == 201
        body = r.json()
        assert body["upserted"] == 3
        assert body["price_count"] == 3
        assert len(body["items"]) == 3
        # 저장 확인
        g = client.get("/api/v1/products/b%3A0").json()
        assert g["name"] == "상품0"
        assert g["last_price"] == 1000
        assert g["min_price"] == 1000

    def test_batch_no_price_upsert_only(self, client):
        items = [_item("b:noprice", name="가격없음")]
        r = client.post("/api/v1/products/batch", json={"items": items})
        assert r.status_code == 201
        assert r.json()["price_count"] == 0
        g = client.get("/api/v1/products/b%3Anoprice").json()
        assert g["last_price"] is None
        assert g["name"] == "가격없음"

    def test_batch_duplicate_product_ids_dedup(self, client):
        items = [
            _item("b:dup", price=1000, name="첫번째"),
            _item("b:dup", price=2000, name="두번째"),  # 같은 product_id — 첫 건만
        ]
        r = client.post("/api/v1/products/batch", json={"items": items})
        assert r.status_code == 201
        assert r.json()["upserted"] == 1
        g = client.get("/api/v1/products/b%3Adup").json()
        assert g["last_price"] == 1000  # 첫 건 가격 유지

    def test_batch_dedup_same_price_no_new_point(self, client):
        """배치 내 같은 가격 반복 — price_points 로우 추가 안 함 (dedup)"""
        client.post("/api/v1/products/batch", json={"items": [_item("b:same", price=5000)]})
        client.post("/api/v1/products/batch", json={"items": [_item("b:same", price=5000)]})
        prices = client.get("/api/v1/products/b%3Asame/prices").json()
        assert len(prices) == 1
        assert prices[0]["price"] == 5000

    def test_batch_partial_failure_continues(self, client):
        """첫 항목이 UNIQUE 충돌이어도 나머지는 저장 (항목 단위 격리)"""
        # 사전에 같은 상품을 같은 초에 다른 가격으로 2번 개별 저장 → UNIQUE(product_id, captured_at) 충돌 준비
        items = [_item("b:crash", price=7000), _item("b:ok", price=1000, name="정상")]
        r = client.post("/api/v1/products/batch", json={"items": items})
        assert r.status_code == 201
        assert r.json()["upserted"] == 2
        g = client.get("/api/v1/products/b%3Aok").json()
        assert g["name"] == "정상"

    def test_batch_empty_items(self, client):
        r = client.post("/api/v1/products/batch", json={"items": []})
        assert r.status_code == 201
        assert r.json() == {"upserted": 0, "price_count": 0, "items": []}
