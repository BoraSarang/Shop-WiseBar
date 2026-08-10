# test_crawler.py — 크롤러 제어/모니터링 API 검증 (v0.16.0, T-117)
# PLATFORM: server
from app.models import CrawlerConfig, CrawlerRun


def _make_config(db_session) -> CrawlerConfig:
    cfg = db_session.get(CrawlerConfig, 1)
    if cfg is None:
        cfg = CrawlerConfig(id=1)
        db_session.add(cfg)
        db_session.commit()
        db_session.refresh(cfg)
    return cfg


class TestCrawlerConfig:
    def test_get_default_config(self, client, db_session):
        _make_config(db_session)
        r = client.get("/api/v1/admin/crawler/config")
        assert r.status_code == 200
        body = r.json()
        assert body["interval_seconds"] == 3600
        assert body["enabled"] is True
        assert body["run_requested"] is False
        assert body["last_run_at"] is None

    def test_put_valid_interval(self, client, db_session):
        _make_config(db_session)
        r = client.put("/api/v1/admin/crawler/config", json={"interval_seconds": 21600})
        assert r.status_code == 200
        assert r.json()["interval_seconds"] == 21600

    def test_put_disallowed_interval_422(self, client, db_session):
        cfg = _make_config(db_session)
        r = client.put("/api/v1/admin/crawler/config", json={"interval_seconds": 120})
        assert r.status_code == 422
        assert db_session.get(CrawlerConfig, 1).interval_seconds == 3600  # 변경 없음

    def test_put_enabled_toggle(self, client, db_session):
        _make_config(db_session)
        r = client.put("/api/v1/admin/crawler/config", json={"enabled": False})
        assert r.status_code == 200
        assert r.json()["enabled"] is False


class TestCrawlerRun:
    def test_run_request_sets_flag(self, client, db_session):
        cfg = _make_config(db_session)
        r = client.post("/api/v1/admin/crawler/run")
        assert r.status_code == 200
        assert r.json()["status"] == "requested"
        assert db_session.get(CrawlerConfig, 1).run_requested is True


class TestCrawlerLogs:
    def test_logs_empty(self, client, db_session):
        r = client.get("/api/v1/admin/crawler/logs")
        assert r.status_code == 200
        assert r.json()["logs"] == []

    def test_logs_lists_runs(self, client, db_session):
        _make_config(db_session)
        db_session.add(CrawlerRun(mall="oliveyoung", success=True, count=2, attempted=5,
                                  duration_ms=70726, trigger="manual"))
        db_session.commit()
        r = client.get("/api/v1/admin/crawler/logs")
        logs = r.json()["logs"]
        assert len(logs) == 1
        assert logs[0]["mall"] == "oliveyoung"
        assert logs[0]["success"] is True
        assert logs[0]["count"] == 2
        assert logs[0]["attempted"] == 5   # v0.16.2 (T-119)
        assert logs[0]["failed"] == 3      # attempted - count - gone
        assert logs[0]["trigger"] == "manual"
        assert "T" in logs[0]["run_at"]  # KST ISO 타임스탬프

    def test_logs_gone_and_error(self, client, db_session):
        """v0.16.8 (T-121) — 상품없음(gone)은 실패에서 제외되고 error 사유가 노출된다."""
        _make_config(db_session)
        db_session.add(CrawlerRun(mall="oliveyoung", success=True, count=0, attempted=3,
                                  gone=3, error=None, duration_ms=75072, trigger="schedule"))
        db_session.add(CrawlerRun(mall="naver", success=True, count=1, attempted=2,
                                  gone=0, error="챌린지/캡차 차단", duration_ms=1803, trigger="manual"))
        db_session.commit()
        logs = {l["mall"]: l for l in client.get("/api/v1/admin/crawler/logs").json()["logs"]}
        oy, nv = logs["oliveyoung"], logs["naver"]
        assert oy["gone"] == 3
        assert oy["failed"] == 0      # 전부 상품없음 → 실패 아님
        assert oy["error"] is None
        assert nv["gone"] == 0
        assert nv["failed"] == 1      # 시도2 - 성공1 - gone0
        assert nv["error"] == "챌린지/캡차 차단"

    def test_logs_attempted_zero_rounds(self, client, db_session):
        """attempted 미기록(마이그레이션 전) 행은 failed 0으로 계산"""
        _make_config(db_session)
        db_session.add(CrawlerRun(mall="naver", success=True, count=0, attempted=0,
                                  duration_ms=800, trigger="schedule"))
        db_session.commit()
        logs = client.get("/api/v1/admin/crawler/logs").json()["logs"]
        assert logs[0]["attempted"] == 0
        assert logs[0]["failed"] == 0

    def test_logs_limit_cap(self, client, db_session):
        _make_config(db_session)
        for i in range(5):
            db_session.add(CrawlerRun(mall="naver", success=True, count=i,
                                      duration_ms=10, trigger="schedule"))
        db_session.commit()
        r = client.get("/api/v1/admin/crawler/logs?limit=3")
        assert len(r.json()["logs"]) == 3