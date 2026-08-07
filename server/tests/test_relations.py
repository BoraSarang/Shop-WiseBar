# relations + recommendations 라우터 테스트
# PLATFORM: server (pytest)
import pytest


class TestRelations:
    def test_save_and_related(self, client):
        for pid in ["rel:a", "rel:b", "rel:c"]:
            client.post("/api/v1/products", json={
                "product_id": pid, "mall": "naver",
                "url": f"https://x/{pid}", "name": pid,
            })
        # a → [b, c] 1회
        r = client.post("/api/v1/products/relations", json={
            "source": "rel:a", "targets": ["rel:b", "rel:c"],
        })
        assert r.status_code == 200
        assert r.json()["saved"] == 2
        # a → [b] 추가 1회 → weight += 1
        client.post("/api/v1/products/relations", json={
            "source": "rel:a", "targets": ["rel:b"],
        })
        rel = client.get("/api/v1/products/rel%3Aa/related").json()
        by_id = {x["product_id"]: x for x in rel}
        assert by_id["rel:b"]["weight"] == 2  # 1회 + 1회
        assert by_id["rel:c"]["weight"] == 1

    def test_dedup_targets_no_500(self, client):
        client.post("/api/v1/products", json={
            "product_id": "rel:x", "mall": "naver", "url": "https://x/relx",
        })
        client.post("/api/v1/products", json={
            "product_id": "rel:y", "mall": "naver", "url": "https://x/rely",
        })
        # 중복 target (동일 y) + source 제외 — 500 없이 1건만 저장
        r = client.post("/api/v1/products/relations", json={
            "source": "rel:x", "targets": ["rel:y", "rel:y", "rel:x"],
        })
        assert r.status_code == 200
        assert r.json()["saved"] == 1


class TestRecommendations:
    def _seed_drop(self, client, pid, prices):
        """가격 시퀀스 주입 — 마지막 가격이 하락이 되도록. captured_at은 순차."""
        from datetime import datetime, timedelta
        client.post("/api/v1/products", json={
            "product_id": pid, "mall": "naver", "url": f"https://x/{pid}", "name": pid,
        })
        now = datetime.utcnow()
        for i, price in enumerate(prices):
            client.post("/api/v1/products/{}/prices?ts_override={}".format(pid, i), json={"price": price})
        return pid

    def test_drop_recommendation(self, client):
        pid = self._seed_drop(client, "rec:drop", [10000, 8000])  # 20% 하락
        client.post("/api/v1/products", json={
            "product_id": "rec:flat", "mall": "naver", "url": "https://x/flat", "name": "flat",
        })
        client.post("/api/v1/products/rec%3Aflat/prices", json={"price": 5000})
        recs = client.get("/api/v1/recommendations?limit=10&days=7").json()
        ids = [x["product_id"] for x in recs]
        assert pid in ids
        item = next(x for x in recs if x["product_id"] == pid)
        assert item["reason"] == "drop"

    def test_empty_no_results(self, client):
        recs = client.get("/api/v1/recommendations?limit=10&days=7").json()
        assert recs == []

    # ── T-105: 공개 핫딜 피드 ─────────────────────────────
    def test_public_deals_aggregates_all_devices(self, client):
        """/deals/public — 다른 기기의 하락 상품도 전체 집계로 노출 + watchers 집계"""
        pid = self._seed_drop(client, "deal:pub", [12000, 9000])  # 25% 하락
        # 다른 기기가 이 상품을 찜 (watchers 집계용)
        client.post("/api/v1/devices", json={"device_id": "dev-aaa"})
        client.post("/api/v1/devices", json={"device_id": "dev-bbb"})
        client.put("/api/v1/devices/dev-aaa/watches/" + pid, json={})
        client.put("/api/v1/devices/dev-bbb/watches/" + pid, json={})
        deals = client.get("/api/v1/deals/public?limit=10&days=7").json()
        item = next((d for d in deals if d["product_id"] == pid), None)
        assert item is not None, f"공개 피드에 하락 상품이 없음: {deals}"
        assert item["reason"] == "drop"
        assert item["watchers"] == 2  # dev-aaa + dev-bbb

    def test_public_deals_no_device_filter(self, client):
        """개인 /recommendations와 달리 공개 피드는 기기 무관 전체 캡처 사용"""
        self._seed_drop(client, "deal:other", [15000, 10000])  # 33% 하락 (다른 기기 데이터)
        deals = client.get("/api/v1/deals/public?limit=10&days=7").json()
        ids = [d["product_id"] for d in deals]
        assert "deal:other" in ids

    def test_public_deals_cache_ok(self, client):
        """같은 파라미터 두 번 호출 — 응답 구조 동일 (캐시 히트 여부는 파악 불가, 200 확인)"""
        self._seed_drop(client, "deal:cache", [20000, 15000])
        r1 = client.get("/api/v1/deals/public?limit=5&days=7").json()
        r2 = client.get("/api/v1/deals/public?limit=5&days=7").json()
        assert r1 == r2
        assert any("watchers" in d for d in r1)


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["db"]["ok"] is True
    assert body["version"]
    assert body["started_at"]
    # v0.10.3 (T-91b) — 인덱스가 스타트업에 적용됐는지 노출
    assert "ix_price_points_captured" in body["indexes"]
    assert "ix_price_daily_prod_date" in body["indexes"]


def test_request_logging_emits(caplog):
    """v0.10.3 (T-91a) — 요청 로그 미들웨어가 메서드/경로/상태를 남긴다."""
    from fastapi.testclient import TestClient

    from app.main import app

    with caplog.at_level("INFO"):
        TestClient(app).get("/health")
    assert any("method=GET path=/health status=200" in r.message for r in caplog.records)