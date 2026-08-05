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


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"