# devices + watches 라우터 테스트
# PLATFORM: server (pytest)
import pytest


class TestDevices:
    def test_create_device_auto(self, client):
        r = client.post("/api/v1/devices")
        assert r.status_code == 200
        assert len(r.json()["device_id"]) > 0

    def test_create_device_custom_reuses(self, client):
        r1 = client.post("/api/v1/devices", json={"device_id": "dev-123"})
        assert r1.json()["device_id"] == "dev-123"
        # 재등록 — 동일 ID 재사용, 200 유지
        r2 = client.post("/api/v1/devices", json={"device_id": "dev-123"})
        assert r2.status_code == 200
        assert r2.json()["device_id"] == "dev-123"


class TestWatches:
    def _make_product(self, client, pid="test:watch:1"):
        client.post("/api/v1/products", json={
            "product_id": pid, "mall": "naver",
            "url": f"https://smartstore.naver.com/test/products/1",
        })

    def test_add_list_remove_watch(self, client):
        self._make_product(client)
        client.post("/api/v1/devices", json={"device_id": "dev"})
        # 찜 추가
        r = client.put("/api/v1/devices/dev/watches/test%3Awatch%3A1", json={"target_price": None})
        assert r.status_code == 200
        # 목록 조회
        lst = client.get("/api/v1/devices/dev/watches").json()
        assert len(lst) == 1
        assert lst[0]["product_id"] == "test:watch:1"
        # 찜 해제 (204)
        d = client.delete("/api/v1/devices/dev/watches/test%3Awatch%3A1")
        assert d.status_code == 204
        lst = client.get("/api/v1/devices/dev/watches").json()
        assert len(lst) == 0

    def test_watch_target_price(self, client):
        self._make_product(client, "test:watch:2")
        client.post("/api/v1/devices", json={"device_id": "dev2"})
        client.put("/api/v1/devices/dev2/watches/test%3Awatch%3A2", json={"target_price": 5000})
        lst = client.get("/api/v1/devices/dev2/watches").json()
        assert lst[0]["target_price"] == 5000
        # 상품 조회에 device_id 전달 시 is_watched/목표가 노출
        g = client.get("/api/v1/products/test%3Awatch%3A2?device_id=dev2").json()
        assert g["is_watched"] is True
        assert g["target_price"] == 5000

    def test_watch_unknown_device_404(self, client):
        self._make_product(client)
        r = client.put("/api/v1/devices/nope/watches/test%3Awatch%3A1", json={"target_price": None})
        assert r.status_code == 404