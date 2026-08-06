# test_tz.py — 시간대 통일 (KST 기준) 검증 (v0.12.2, T-102)
# PLATFORM: server
from datetime import datetime, timezone

from app.datetimeutil import kst_date, KST


class TestKST:
    def test_kst_date_utc_evening_is_next_kst_day(self):
        # UTC 2026-08-05 16:00 = KST 2026-08-06 01:00 (하루 경계 밀림)
        d = kst_date(datetime(2026, 8, 5, 16, 0, tzinfo=timezone.utc))
        assert (d.year, d.month, d.day) == (2026, 8, 6)

    def test_kst_date_utc_morning_same_kst_day(self):
        # UTC 2026-08-06 00:00 = KST 2026-08-06 09:00 (같은 날)
        d = kst_date(datetime(2026, 8, 6, 0, 0, tzinfo=timezone.utc))
        assert (d.year, d.month, d.day) == (2026, 8, 6)

    def test_kst_date_naive_treated_as_utc(self):
        # naive 입력은 UTC 규약으로 간주
        d = kst_date(datetime(2026, 8, 5, 16, 0))
        assert (d.year, d.month, d.day) == (2026, 8, 6)

    def test_kst_offset_is_nine_hours(self):
        from datetime import timedelta
        assert KST.utcoffset(datetime(2026, 1, 1)) == timedelta(hours=9)


class TestKSTDailyStat:
    def test_upload_evening_utc_buckets_to_next_kst_day(self, client):
        # UTC 08-05 16:00 저장 → KST 08-06 01:00 → stat_date=08-06 (하루 안 밀림)
        client.post("/api/v1/products", json={
            "product_id": "test:tz:1", "mall": "naver",
            "url": "https://shopping.naver.com/test/1", "name": "tz 상품",
        })
        r = client.post(
            "/api/v1/products/test%3Atz%3A1/prices",
            json={"price": 10000, "captured_at": "2026-08-05T16:00:00Z"},
        )
        assert r.status_code == 201
        stats = client.get("/api/v1/products/test%3Atz%3A1/stats").json()
        # 전체(overall) 최저 날짜가 KST 08-06으로 반환 (UTC 날짜 08-05가 아님)
        assert stats["overall"]["min_date"] == "2026-08-06"