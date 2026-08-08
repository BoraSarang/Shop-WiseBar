# test_admin.py — macOS 똑바Admin 앱용 /admin/* 집계 검증 (v0.15.0, T-115a)
# PLATFORM: server


def _seed(client, pid: str, mall: str, name: str, price: int, captured_at: str):
    client.post("/api/v1/products", json={
        "product_id": pid, "mall": mall, "url": f"https://x.test/{pid}",
        "name": name,
    })
    r = client.post(
        f"/api/v1/products/{pid}/prices",
        json={"price": price, "captured_at": captured_at, "source": "extension"},
    )
    assert r.status_code == 201


class TestAdminOverview:
    def test_empty_overview(self, client):
        r = client.get("/api/v1/admin/overview")
        assert r.status_code == 200
        body = r.json()
        assert body["products"] == 0
        assert body["watches"] == 0
        assert body["alerts"] == 0
        assert {"products", "devices", "watches", "price_points", "daily_stats",
                "alerts", "relations", "priced", "sold_out"} <= set(body)

    def test_overview_counts(self, client):
        _seed(client, "p1", "naver", "상품A", 10000, "2026-08-05T10:00:00Z")
        _seed(client, "p2", "coupang", "상품B", 5000, "2026-08-05T11:00:00Z")
        r = client.get("/api/v1/admin/overview").json()
        assert r["products"] == 2
        assert r["price_points"] >= 2  # 캡처 2회 → 2 포인트 이상
        assert r["priced"] == 2
        assert r["sold_out"] == 0


class TestAdminTrend:
    def test_trend_returns_days_series(self, client):
        _seed(client, "p1", "naver", "트렌드 A", 10000, "2026-08-05T10:00:00Z")
        r = client.get("/api/v1/admin/trend?days=7")
        assert r.status_code == 200
        body = r.json()
        assert len(body["days"]) == 7
        assert {"date", "captures", "points", "new"} == set(body["days"][0])
        total_points = sum(d["points"] for d in body["days"])
        assert total_points >= 1


class TestAdminMalls:
    def test_malls_per_mall(self, client):
        _seed(client, "p1", "naver", "네이버 상품", 9000, "2026-08-05T10:00:00Z")
        _seed(client, "p2", "oliveyoung", "올리브 상품", 3000, "2026-08-05T11:00:00Z")
        r = client.get("/api/v1/admin/malls").json()
        malls = {m["mall"]: m for m in r["malls"]}
        assert malls["naver"]["products"] == 1
        assert malls["oliveyoung"]["products"] == 1
        assert malls["coupang"]["products"] == 0
        assert malls["naver"]["avg_price"] is not None


class TestAdminCollect:
    def test_sources_and_total(self, client):
        _seed(client, "p1", "naver", "수집 상품", 8000, "2026-08-05T10:00:00Z")
        r = client.get("/api/v1/admin/collect").json()
        assert r["total"] >= 1
        sources = {s["source"]: s["count"] for s in r["sources"]}
        assert "extension" in sources
        assert r["last_capture_at"] is not None


class TestAdminInsight:
    def test_empty_insight(self, client):
        r = client.get("/api/v1/admin/insight?days=7")
        assert r.status_code == 200
        body = r.json()
        assert body["alert_distribution"] == []
        assert body["recent_alerts"] == []
        assert body["top_drops"] == []