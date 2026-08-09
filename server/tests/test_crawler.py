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
        db_session.add(CrawlerRun(mall="oliveyoung", success=True, count=2,
                                  duration_ms=70726, trigger="manual"))
        db_session.commit()
        r = client.get("/api/v1/admin/crawler/logs")
        logs = r.json()["logs"]
        assert len(logs) == 1
        assert logs[0]["mall"] == "oliveyoung"
        assert logs[0]["success"] is True
        assert logs[0]["count"] == 2
        assert logs[0]["trigger"] == "manual"
        assert "T" in logs[0]["run_at"]  # KST ISO 타임스탬프

    def test_logs_limit_cap(self, client, db_session):
        _make_config(db_session)
        for i in range(5):
            db_session.add(CrawlerRun(mall="naver", success=True, count=i,
                                      duration_ms=10, trigger="schedule"))
        db_session.commit()
        r = client.get("/api/v1/admin/crawler/logs?limit=3")
        assert len(r.json()["logs"]) == 3