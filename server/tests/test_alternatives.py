# 크로스몰 매칭(normalized_name) + alternatives 비교 테스트 (v0.13.0, T-106/T-107)
# PLATFORM: server (pytest)
import pytest

from app.services.name_normalizer import normalize


class TestNormalizer:
    def test_lowercase_and_space(self):
        assert normalize("Apple Watch SE") == "apple watch se"

    def test_symbols_to_space(self):
        assert normalize("브리츠 (BE) 이어폰") == "브리츠 be 이어폰"

    def test_stopword_removed(self):
        assert normalize("새우깡 세트 구성") == "새우깡"
        assert normalize("브리츠 이어폰 정품 선물용") == "브리츠 이어폰"

    def test_number_model_kept(self):
        assert normalize("갤럭시 S25 울트라") == "갤럭시 s25 울트라"

    def test_empty_and_none(self):
        assert normalize(None) is None
        assert normalize("세트 구성 선물") is None

    def test_cross_mall_same_product(self):
        # 몰별 표기 차이("X·" 공백/괄호/불용어)가 같은 키로 정규화되는지
        assert normalize("브리츠 블루투스 이어폰 (정품)") == normalize("브리츠 블루투스 이어폰")
        assert normalize("에스쁘아 라이브 벨벳 플러스 세트") == normalize("에스쁘아 라이브 벨벳 플러스")


class TestAlternatives:
    def _seeds(self, client):
        # 네이버 상품
        r = client.post(
            "/api/v1/products",
            json={"product_id": "naver:1", "mall": "naver", "url": "https://n/1",
                  "name": "브리츠 블루투스 이어폰 정품 선물", "source": "detail"},
        )
        assert r.status_code == 201
        client.post("/api/v1/products/naver%3A1/prices", json={"price": 26900, "source": "extension"})
        # 쿠팡 동일 상품 (정규화 동일 키)
        client.post(
            "/api/v1/products",
            json={"product_id": "coupang:1", "mall": "coupang", "url": "https://c/1",
                  "name": "브리츠 블루투스 이어폰 정품", "source": "detail"},
        )
        client.post("/api/v1/products/coupang%3A1/prices", json={"price": 24500, "source": "extension"})
        # 올리브영 같은 상품 (가격 근접)
        client.post(
            "/api/v1/products",
            json={"product_id": "oly:1", "mall": "oliveyoung", "url": "https://o/1",
                  "name": "브리츠 블루투스 이어폰 정품", "source": "detail"},
        )
        client.post("/api/v1/products/oly%3A1/prices", json={"price": 28000, "source": "extension"})
        # 다른 상품 (키 다름)
        client.post(
            "/api/v1/products",
            json={"product_id": "oly:2", "mall": "oliveyoung", "url": "https://o/2",
                  "name": "토끼 인형", "source": "detail"},
        )
        client.post("/api/v1/products/oly%3A2/prices", json={"price": 15000, "source": "extension"})

    def test_naver_product_has_coupang_and_oly(self, client):
        self._seeds(client)
        body = client.get("/api/v1/products/naver%3A1").json()
        alts = body["alternatives"]
        malls = {a["mall"] for a in alts}
        assert "coupang" in malls  # 24500 → 차이 ~+9.8%
        assert "oliveyoung" in malls  # 28000 → 차이 ~-4%
        assert all(a["product_id"] != "naver:1" for a in alts)  # 자기 자신 배제
        assert all(a["last_price"] is not None for a in alts)

    def test_price_range_excluded(self, client):
        self._seeds(client)
        # 가격이 ±30% 초과하는 상품은 제외 (같은 정규화 키 + 저렴한 가격)
        client.post(
            "/api/v1/products",
            json={"product_id": "coupang:2", "mall": "coupang", "url": "https://c/2",
                  "name": "브리츠 블루투스 이어폰 정품 선물", "source": "detail"},
        )
        client.post("/api/v1/products/coupang%3A2/prices", json={"price": 12000, "source": "extension"})  # 26900의 -55%
        body = client.get("/api/v1/products/naver%3A1").json()
        malls = {a["mall"] for a in body["alternatives"]}
        assert "coupang" in malls  # coupang:1 (24500) 유지
        c2 = [a for a in body["alternatives"] if a["product_id"] == "coupang:2"]
        assert not c2  # coupang:2 (12000)는 범위 밖 — 미포함

    def test_same_mall_excluded(self, client):
        # 같은 몰 내 같은 키 상품은 제외 (다른 몰만 비교)
        client.post(
            "/api/v1/products",
            json={"product_id": "naver:2", "mall": "naver", "url": "https://n/2",
                  "name": "브리츠 블루투스 이어폰", "source": "detail"},
        )
        client.post("/api/v1/products/naver%3A2/prices", json={"price": 25000, "source": "extension"})
        # 네이버 상품 하나만 존재 (같은 몰 동일 키) → alternatives 비어 있어야
        body = client.get("/api/v1/products/naver%3A2").json()
        assert body["alternatives"] == []

    def test_no_match_empty(self, client):
        client.post(
            "/api/v1/products",
            json={"product_id": "oly:3", "mall": "oliveyoung", "url": "https://o/3",
                  "name": "콜라 제로", "source": "detail"},
        )
        body = client.get("/api/v1/products/oly%3A3").json()
        assert body["alternatives"] == []


class TestWatchAlternatives:
    def _seed_with_watch(self, client):
        # 네이버 + 쿠팡 동일 상품 + 네이버 찜
        client.post(
            "/api/v1/products",
            json={"product_id": "naver:w1", "mall": "naver", "url": "https://n/w1",
                  "name": "브리츠 블루투스 이어폰", "source": "detail"},
        )
        client.post("/api/v1/products/naver%3Aw1/prices", json={"price": 26900, "source": "extension"})
        client.post(
            "/api/v1/products",
            json={"product_id": "coupang:w1", "mall": "coupang", "url": "https://c/w1",
                  "name": "브리츠 블루투스 이어폰 정품", "source": "detail"},
        )
        client.post("/api/v1/products/coupang%3Aw1/prices", json={"price": 24000, "source": "extension"})
        client.post("/api/v1/devices", json={"device_id": "dev-w1"})
        client.put("/api/v1/devices/dev-w1/watches/naver%3Aw1", json={})

    def test_list_without_include_no_alts(self, client):
        self._seed_with_watch(client)
        body = client.get("/api/v1/devices/dev-w1/watches").json()
        assert len(body) == 1
        assert body[0]["alternatives"] == []

    def test_list_include_alternatives(self, client):
        self._seed_with_watch(client)
        body = client.get("/api/v1/devices/dev-w1/watches", params={"include_alternatives": "true"}).json()
        assert len(body) == 1
        alts = body[0]["alternatives"]
        assert any(a["mall"] == "coupang" for a in alts)
        assert all(a["mall"] != "naver" for a in alts)