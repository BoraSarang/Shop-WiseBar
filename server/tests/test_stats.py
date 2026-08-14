# test_stats.py — 매니저 "통계" 탭용 /admin/stats/* 집계 검증 (v0.16.19, T-129)
# PLATFORM: server
from datetime import datetime, timedelta

from app.datetimeutil import KST


def _today() -> str:
    return datetime.now(KST).date().isoformat()


def _seed(client, pid: str, mall: str, name: str, price: int, captured_at: str | None = None):
    client.post("/api/v1/products", json={
        "product_id": pid, "mall": mall, "url": f"https://x.test/{pid}",
        "name": name,
    })
    body = {"price": price, "source": "extension"}
    if captured_at:
        body["captured_at"] = captured_at
    r = client.post(f"/api/v1/products/{pid}/prices", json=body)
    assert r.status_code == 201


class TestCollectByMall:
    def test_mall_split(self, client):
        _seed(client, "p1", "naver", "네이버 A", 10000)
        _seed(client, "p2", "oliveyoung", "올리브 B", 3000)
        _seed(client, "p3", "coupang", "쿠팡 C", 5000)
        _seed(client, "p4", "naver", "네이버 D", 12000)  # 같은 날 naver 2회
        r = client.get("/api/v1/admin/stats/collect-by-mall?days=7")
        assert r.status_code == 200
        days = {d["date"]: d for d in r.json()["days"]}
        today = _today()
        assert today in days
        assert {"date", "coupang", "naver", "oliveyoung"} == set(days[today])
        assert days[today]["naver"] == 2
        assert days[today]["oliveyoung"] == 1
        assert days[today]["coupang"] == 1


class TestPriceMovement:
    def test_down_and_up(self, client):
        today = datetime.now(KST).date()
        d1 = (today - timedelta(days=1)).isoformat()
        # 하락: 어제 10000 → 오늘 9000
        _seed(client, "p1", "naver", "하락 A", 10000, f"{d1}T10:00:00Z")
        _seed(client, "p1", "naver", "하락 A", 9000)
        # 상승: 어제 5000 → 오늘 7000
        _seed(client, "p2", "coupang", "상승 B", 5000, f"{d1}T11:00:00Z")
        _seed(client, "p2", "coupang", "상승 B", 7000)
        r = client.get("/api/v1/admin/stats/price-movement?days=7").json()
        days = {d["date"]: d for d in r["days"]}
        t = _today()
        assert days[t]["down"] == 1
        assert days[t]["up"] == 1
        assert days[t]["flat"] == 0

    def test_flat_when_unchanged(self, client):
        today = datetime.now(KST).date()
        d1 = (today - timedelta(days=1)).isoformat()
        _seed(client, "p1", "naver", "동일가 A", 10000, f"{d1}T10:00:00Z")
        _seed(client, "p1", "naver", "동일가 A", 10000)  # 같은 가격 → 오늘 flat
        r = client.get("/api/v1/admin/stats/price-movement?days=7").json()
        days = {d["date"]: d for d in r["days"]}
        assert days[_today()]["flat"] >= 1


class TestTopMovers:
    def test_drop_and_rise(self, client):
        today = datetime.now(KST).date()
        d1 = (today - timedelta(days=1)).isoformat()
        d2 = (today - timedelta(days=2)).isoformat()
        # 하락 5% 초과: 11000 → 9000 (18.2%)
        _seed(client, "drop1", "naver", "대폭 하락", 11000, f"{d2}T10:00:00Z")
        _seed(client, "drop1", "naver", "대폭 하락", 9000)
        # 하락 5% 미만: 10000 → 9800 (2%) → 미포함
        _seed(client, "drop2", "coupang", "소폭 하락", 10000, f"{d2}T10:00:00Z")
        _seed(client, "drop2", "coupang", "소폭 하락", 9800)
        # 상승 5% 초과: 10000 → 15000 (50%)
        _seed(client, "rise1", "oliveyoung", "대폭 상승", 10000, f"{d1}T10:00:00Z")
        _seed(client, "rise1", "oliveyoung", "대폭 상승", 15000)

        r = client.get("/api/v1/admin/stats/top-movers?limit=10").json()
        drops = {d["product_id"]: d for d in r["drops"]}
        risers = {d["product_id"]: d for d in r["risers"]}

        assert drops["drop1"]["change_pct"] == 18.2
        assert drops["drop1"]["mall"] == "naver"
        assert "drop2" not in drops  # 5% 미만 제외
        assert risers["rise1"]["change_pct"] == 50.0


class TestUsers:
    def test_new_devices_watches_and_active(self, client):
        client.post("/api/v1/devices", json={"device_id": "dev1"})
        client.post("/api/v1/devices", json={"device_id": "dev2"})
        _seed(client, "p1", "naver", "상품A", 10000)
        rw = client.put("/api/v1/devices/dev1/watches/p1", json={"target_price": 8000})
        assert rw.status_code == 200

        r = client.get("/api/v1/admin/stats/users?days=7").json()
        days = {d["date"]: d for d in r["days"]}
        today = _today()
        assert days[today]["new_devices"] == 2
        assert days[today]["new_watches"] == 1
        assert r["totals"]["devices"] == 2
        assert r["totals"]["active_24h"] == 0  # heartbeat 없음 → 활성 0
        assert {"date", "new_devices", "active_7d", "new_watches"} == set(days[today])
