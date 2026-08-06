# T-96a — 데모 데이터 자동 주입/삭제 (상품 전체 삭제 API) 테스트
# PLATFORM: server
import time

from sqlalchemy import func, select

from app.models import (
    PriceDailyStat,
    PricePoint,
    Product,
    Watch,
)


def _seed(client, pid, name="데모 상품"):
    r = client.post(
        "/api/v1/products/batch",
        json={
            "items": [
                {
                    "product_id": pid,
                    "mall": "naver",
                    "url": f"https://smartstore.naver.com/demo/products/1",
                    "name": name,
                    "price": 10000,
                }
            ]
        },
    )
    assert r.status_code == 201


def _count(db_session, model, product_id):
    col = model.__table__.columns["product_id"]
    return db_session.scalar(
        select(func.count()).select_from(model).where(col == product_id)
    )


class TestDeleteProduct:
    def test_delete_product_removes_all_relations(self, client, db_session):
        pid = "demo:cleanup"
        _seed(client, pid)
        # 하락 이력 2개 추가 (가격 포인트 2개 + 일별 통계) — 같은 초 UNIQUE 회피 위해 1.1s 간격
        for price in (9000, 8500):
            r = client.post(f"/api/v1/products/{pid}/prices", json={"price": price})
            assert r.status_code == 201
            time.sleep(1.1)
        # 찜 1건 추가
        client.post("/api/v1/devices", json={"device_id": "demo-dev"})
        client.put("/api/v1/devices/demo-dev/watches/" + pid)

        # 상품 삭제
        r = client.delete(f"/api/v1/products/{pid}")
        assert r.status_code == 204

        # 하위 레코드 전부 정리됐는지 검증
        assert _count(db_session, PricePoint, pid) == 0
        assert _count(db_session, PriceDailyStat, pid) == 0
        assert _count(db_session, Watch, pid) == 0
        assert db_session.get(Product, pid) is None

    def test_delete_nonexistent_returns_204(self, client):
        r = client.delete("/api/v1/products/nope:missing")
        assert r.status_code == 204
