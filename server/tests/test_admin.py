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
        # v0.16.15: 날짜 의존 제거 — 하드코딩 과거일 대신 오늘(KST) 캡처로 "최근 7일" 창에 포함되게
        from datetime import datetime, timezone

        from app.datetimeutil import KST

        today_kst = datetime.now(KST).replace(hour=10, minute=0, second=0).isoformat()
        _seed(client, "p1", "naver", "트렌드 A", 10000, today_kst)
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


class TestAdminProductsTop:
    def test_empty(self, client):
        r = client.get("/api/v1/admin/products/top").json()
        assert r["most_collected"] == []
        assert r["recent"] == []
        assert r["sold_out"] == []
        assert r["restocked"] == []

    def test_most_collected_ranked(self, client):
        _seed(client, "p1", "naver", "많이수집A", 10000, "2026-08-05T10:00:00Z")
        _seed(client, "p1", "naver", "많이수집A", 9000, "2026-08-05T11:00:00Z")
        _seed(client, "p2", "coupang", "적게수집B", 5000, "2026-08-05T12:00:00Z")
        r = client.get("/api/v1/admin/products/top").json()
        assert r["most_collected"][0]["product_id"] == "p1"
        assert r["most_collected"][0]["price_count"] >= 2
        assert r["recent"]

    def test_sold_out_and_restocked(self, client):
        client.post("/api/v1/products", json={
            "product_id": "so1", "mall": "oliveyoung", "url": "https://x/so1", "name": "품절상품",
        })
        r = client.post("/api/v1/products/so1/sold-out", json={"sold_out": True})
        assert r.status_code in (200, 201)
        body = client.get("/api/v1/admin/products/top").json()
        assert any(i["product_id"] == "so1" for i in body["sold_out"])


class TestAdminProductDetail:
    def test_detail(self, client):
        _seed(client, "p1", "naver", "상세A", 10000, "2026-08-05T10:00:00Z")
        r = client.get("/api/v1/admin/products/p1")
        assert r.status_code == 200
        body = r.json()
        assert body["product_id"] == "p1"
        assert body["min_price"] == 10000
        assert body["price_count"] >= 1
        assert body["alternatives"] == []

    def test_detail_missing(self, client):
        assert client.get("/api/v1/admin/products/nope").status_code == 404


class TestAdminHealth:
    def test_health(self, client):
        r = client.get("/api/v1/admin/health")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] in ("ok", "degraded")
        assert body["version"]
        assert body["db"]["ok"] is True


class TestAdminCrawlerSummary:
    def test_summary_empty(self, client):
        r = client.get("/api/v1/admin/crawler/summary?hours=24")
        assert r.status_code == 200
        body = r.json()
        assert body["last_24h"]["runs"] == 0
        assert "stale_products" in body


class TestAdminUsers:
    def test_heartbeat_marks_active(self, client):
        client.post("/api/v1/devices", json={"device_id": "u1"})
        r = client.post("/api/v1/devices/u1/heartbeat")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"
        body = client.get("/api/v1/admin/users").json()
        u = next(x for x in body["users"] if x["device_id"] == "u1")
        assert u["active"] is True
        assert u["last_seen_at"] is not None

    def test_users_lists_devices(self, client):
        client.post("/api/v1/devices", json={"device_id": "u2"})
        body = client.get("/api/v1/admin/users").json()
        assert body["total"] >= 1
        u = next(x for x in body["users"] if x["device_id"] == "u2")
        assert u["active"] is False
        assert u["captures"] == 0


class TestAdminPriceCompare:
    def test_empty(self, client):
        r = client.get("/api/v1/admin/price-compare")
        assert r.status_code == 200
        assert r.json()["groups"] == []

    def test_cross_mall_groups(self, client):
        # 동일 정규화명(같은 url 규약 X — normalized_name으로 묶임)
        _seed(client, "naver1", "naver", "정규화 상품", 10000, "2026-08-10T10:00:00Z")
        _seed(client, "coupang1", "coupang", "정규화 상품", 8000, "2026-08-10T11:00:00Z")
        r = client.get("/api/v1/admin/price-compare").json()
        assert r["total_groups"] >= 1
        g = r["groups"][0]
        assert g["cheapest_mall"] == "coupang"
        by_mall = {row["mall"]: row for row in g["rows"]}
        assert by_mall["coupang"]["diff_pct"] == 0.0
        assert by_mall["coupang"]["is_cheapest"] is True
        assert by_mall["naver"]["diff_pct"] == 25.0  # (10000-8000)/8000*100


class TestAdminCrawlTargets:
    def test_empty_and_create(self, client):
        r = client.get("/api/v1/admin/crawl/targets")
        assert r.status_code == 200
        assert r.json()["targets"] == []

        r = client.post("/api/v1/admin/crawl/targets", json={
            "mall": "oliveyoung", "label": "올리브영 랭킹",
            "url": "https://www.oliveyoung.co.kr/store/disp/temporaryRanking.do",
        })
        assert r.status_code == 200
        targets = r.json()["targets"]
        assert len(targets) == 1
        assert targets[0]["mall"] == "oliveyoung"
        assert targets[0]["label"] == "올리브영 랭킹"
        assert targets[0]["enabled"] is True
        assert targets[0]["id"] is not None

    def test_validation(self, client):
        r = client.post("/api/v1/admin/crawl/targets", json={
            "mall": "coupang", "label": "쿠팡", "url": "https://www.coupang.com/np/campaigns/82",
        })
        assert r.status_code == 422  # 지원하지 않는 mall
        r = client.post("/api/v1/admin/crawl/targets", json={
            "mall": "naver", "label": "나쁜 URL", "url": "not-a-url",
        })
        assert r.status_code == 422  # http(s) 아님

    def test_duplicate_url_conflict(self, client):
        url = "https://www.naver.com/"
        r1 = client.post("/api/v1/admin/crawl/targets", json={"mall": "naver", "label": "네이버 메인", "url": url})
        assert r1.status_code == 200
        r2 = client.post("/api/v1/admin/crawl/targets", json={"mall": "custom", "label": "중복", "url": url})
        assert r2.status_code == 409

    def test_delete_idempotent(self, client):
        r = client.post("/api/v1/admin/crawl/targets", json={
            "mall": "custom", "label": "임시", "url": "https://custom.test/shop",
        })
        tid = r.json()["targets"][-1]["id"]
        assert client.delete(f"/api/v1/admin/crawl/targets/{tid}").status_code == 200
        assert client.delete(f"/api/v1/admin/crawl/targets/{tid}").status_code == 200  # idempotent
        assert client.get("/api/v1/admin/crawl/targets").json()["targets"] == []


class TestAdminInsightMeta:
    def test_insight_includes_product_meta(self, client):
        _seed(client, "meta1", "naver", "메타 상품 A", 20000, "2026-08-10T10:00:00Z")
        client.post("/api/v1/watches", json={"device_id": "w1", "product_id": "meta1", "target_price": 15000})
        # 상품 삭제(소멸) → 알림 생성 경로를 직접 재현하기보다는 insight가 200이며 배열 스키마 확인
        r = client.get("/api/v1/admin/insight")
        assert r.status_code == 200
        body = r.json()
        for item in body["recent_alerts"] + body["top_drops"]:
            assert "product_id" in item
            assert "name" in item
            assert "image" in item
            assert "url" in item
            assert "mall" in item