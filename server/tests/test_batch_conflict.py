# batch 라우터 — 실제 IntegrityError(같은 초 다른 가격) 부분 실패 경로 검증 (v0.10.4)
# 목적: upsert_batch의 savepoint(begin_nested)가 실패 항목만 스킵하고 세션을 오염시키지 않는지,
#       이후 항목·이후 요청이 정상 동작하는지 확인 (test_batch.py의 주석은 실제 충돌을 안 만듦)
import pytest
from app.models import PricePoint


class TestBatchRealConflict:
    def _seed_conflict(self, client, db_session, pid, price, captured_at):
        """같은 초에 이미 저장된 가격 포인트를 직접 심어 UNIQUE(product_id, captured_at) 충돌 유발"""
        db_session.add(PricePoint(product_id=pid, price=price, source="extension", captured_at=captured_at))
        db_session.commit()

    def test_same_second_conflict_skips_item_only(self, client, db_session, monkeypatch):
        from datetime import datetime, timezone
        from app.routers import products as products_router

        now = datetime.now(timezone.utc).replace(microsecond=0)

        # 같은 초에 다른 가격이 이미 존재 → batch의 _apply_price flush가 IntegrityError
        self._seed_conflict(client, db_session, "b:conflict", 500, now)
        # 이후 항목도 같은 초 → 이쪽은 이미 같은 가격이므로 dedup(추가 INSERT 없음), 세션 정상 유지돼야
        self._seed_conflict(client, db_session, "b:sameprice", 700, now)

        r = client.post(
            "/api/v1/products/batch",
            json={
                "items": [
                    {"product_id": "b:conflict", "mall": "naver", "url": "https://x/conflict", "price": 999},
                    {"product_id": "b:ok", "mall": "naver", "url": "https://x/ok", "price": 1000},
                ]
            },
        )
        assert r.status_code == 201
        body = r.json()
        # b:conflict는 flush 충돌 → 항목 스킵 (upserted/items에 없음), b:ok는 저장
        assert body["upserted"] == 1
        assert body["price_count"] == 1
        assert [i["product_id"] for i in body["items"]] == ["b:ok"]

        # 세션이 오염되지 않아 이후 요청도 정상 (begin_nested 실패 후 rollback 검증)
        g = client.get("/api/v1/products/b%3Aok").json()
        assert g["last_price"] == 1000

        # 충돌 항목은 기존 가격 유지 (첫 가격 500이 남아있어야 함)
        prices = client.get("/api/v1/products/b%3Aconflict/prices").json()
        assert [p["price"] for p in prices] == [500]

    def test_conflict_then_commit_writes_other_item(self, client, db_session):
        from datetime import datetime, timezone

        now = datetime.now(timezone.utc).replace(microsecond=0)
        self._seed_conflict(client, db_session, "b:dup", 300, now)

        r = client.post(
            "/api/v1/products/batch",
            json={
                "items": [
                    {"product_id": "b:dup", "mall": "naver", "url": "https://x/dup", "price": 300},
                    {"product_id": "b:after", "mall": "naver", "url": "https://x/after", "price": 2000},
                ]
            },
        )
        # b:dup는 같은 초 같은 가격 → dedup(INSERT 없음, 정상), b:after 저장 — 실패 아님
        assert r.status_code == 201
        assert r.json()["upserted"] == 2
        g = client.get("/api/v1/products/b%3Aafter").json()
        assert g["last_price"] == 2000
