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


class TestAlerts:
    """품절 복귀(back_in_stock) 알림 (v0.14.0, T-110)"""

    def _since(self, dt) -> str:
        # ISO +00:00의 '+'는 URL에서 공백으로 해석 → %2B 인코딩
        s = dt.isoformat() if hasattr(dt, "isoformat") else dt
        return s.replace("+", "%2B")

    def _setup(self, client, pid="test:alert:1"):
        client.post("/api/v1/products", json={
            "product_id": pid, "mall": "naver",
            "url": f"https://smartstore.naver.com/test/products/{pid}",
        })
        client.post("/api/v1/devices", json={"device_id": "alert-dev"})
        client.put(f"/api/v1/devices/alert-dev/watches/{pid.replace(':', '%3A')}", json={"target_price": None})

    def test_back_in_stock_once(self, client):
        from datetime import datetime, timedelta, timezone

        pid = "test:alert:1"
        self._setup(client)
        # 품절
        client.post(f"/api/v1/products/{pid}/sold-out", json={"sold_out": True})
        # 복귀: 가격 캡처 (captured_at = T) → back_on_sale_at = T
        T = datetime.now(timezone.utc).replace(microsecond=0)
        client.post(f"/api/v1/products/{pid}/prices",
                    json={"price": 9000, "captured_at": T.isoformat()})
        # since가 T 이전 → back_in_stock 1회
        before = (T - timedelta(minutes=5)).isoformat()
        alerts = client.get(f"/api/v1/devices/alert-dev/alerts?since={self._since(before)}").json()
        backs = [a for a in alerts if a["alert_type"] == "back_in_stock"]
        assert len(backs) == 1
        assert backs[0]["product_id"] == pid
        assert backs[0]["price"] == 9000
        # since를 T 이후로 갱신 → 재전달 없음
        after = (T + timedelta(minutes=5)).isoformat()
        alerts = client.get(f"/api/v1/devices/alert-dev/alerts?since={self._since(after)}").json()
        assert all(a["alert_type"] != "back_in_stock" for a in alerts)

    def test_back_in_stock_not_on_initial_poll(self, client):
        from datetime import datetime, timezone

        pid = "test:alert:2"
        self._setup(client, pid)
        client.post(f"/api/v1/products/{pid}/sold-out", json={"sold_out": True})
        T = datetime.now(timezone.utc).replace(microsecond=0)
        client.post(f"/api/v1/products/{pid}/prices",
                    json={"price": 9000, "captured_at": T.isoformat()})
        # since=None(최초 폴링) → 복귀 알림 없음 (노이즈 방지)
        alerts = client.get("/api/v1/devices/alert-dev/alerts").json()
        assert all(a["alert_type"] != "back_in_stock" for a in alerts)

    def test_price_drop_after_back_in_stock(self, client):
        from datetime import datetime, timedelta, timezone

        pid = "test:alert:3"
        self._setup(client, pid)
        client.post(f"/api/v1/products/{pid}/sold-out", json={"sold_out": True})
        T = datetime.now(timezone.utc).replace(microsecond=0)
        client.post(f"/api/v1/products/{pid}/prices",
                    json={"price": 9000, "captured_at": T.isoformat()})
        # 복귀 후 하락 캡처
        client.post(f"/api/v1/products/{pid}/prices",
                    json={"price": 8000, "captured_at": (T + timedelta(minutes=1)).isoformat()})
        since = (T - timedelta(minutes=5)).isoformat()
        alerts = client.get(f"/api/v1/devices/alert-dev/alerts?since={self._since(since)}").json()
        types = [a["alert_type"] for a in alerts]
        assert "back_in_stock" in types
        assert "price_dropped" in types  # 복귀 후 하락도 정상 감지