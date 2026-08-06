# datetimeutil.py — 시간대 헬퍼 (v0.12.2, T-102)
# PLATFORM: server
# DB는 UTC aware로 저장하되, 일(daily) 경계·통계·표시는 한국 표준시(KST, UTC+9) 기준으로 집계한다.
# 한국 사용자 전용 서비스이므로 일자 계산이 KST여야 그래프(확장 로컬)와 하루 어긋나지 않는다.
from datetime import date, datetime, timedelta, timezone

KST = timezone(timedelta(hours=9))


def kst_date(now: datetime | None = None) -> date:
    """UTC aware(또는 naive=UTC 가정) 시각 → KST 날짜(date). now가 없으면 현재 UTC 시각 기준."""
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)  # naive는 서버 저장 규약(UTC)으로 간주
    return now.astimezone(KST).date()
