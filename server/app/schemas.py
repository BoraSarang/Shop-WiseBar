# Pydantic 스키마 — API 요청/응답
# PLATFORM: server
from datetime import date, datetime

from pydantic import BaseModel, Field


class DeviceOut(BaseModel):
    device_id: str


class DeviceRegisterIn(BaseModel):
    device_id: str | None = None  # 클라이언트가 생성한 UUID (있으면 그대로 등록 — 중복 발급 방지)


class ProductUpsertIn(BaseModel):
    product_id: str = Field(..., max_length=255)
    mall: str = Field(..., max_length=32)
    url: str = Field(..., max_length=1024)
    name: str | None = None
    image: str | None = None
    source: str | None = Field(None, max_length=16)  # detail(상세 페이지 실시간) | card(검색/연관 카드) — 이름 갱신 정책 분기


class PriceUploadIn(BaseModel):
    price: int = Field(..., gt=0)
    source: str = Field("client", max_length=16)  # client | crawler | extension
    variant: str | None = Field(None, max_length=128)  # 쿠팡 옵션(itemId) — 옵션별 가격 분리용
    captured_at: datetime | None = None  # v0.10.7 (T-96a) — 과거 시점 가격 등록 (데모 시딩용)


class SoldOutIn(BaseModel):
    sold_out: bool  # v0.9.1 — 품절 상태 (true=품절 시작, false=재판매)


class BatchItemIn(BaseModel):
    """v0.10.4 (T-93) — 연관 상품 일괄 업로드 항목. 개별 POST /products + /prices 대체.
    price 있으면 함께 저장, 없으면 상품 upsert만 (연관 카드에 가격 미노출인 경우)."""
    product_id: str = Field(..., max_length=255)
    mall: str = Field(..., max_length=32)
    url: str = Field(..., max_length=1024)
    name: str | None = None
    image: str | None = None
    source: str | None = Field(None, max_length=16)
    price: int | None = Field(None, gt=0)


class ProductBatchIn(BaseModel):
    items: list[BatchItemIn] = Field(..., max_length=50)


class ProductOut(BaseModel):
    product_id: str
    mall: str
    url: str
    name: str | None
    image: str | None
    last_price: int | None
    last_checked_at: datetime | None
    sold_out: bool = False  # v0.9.1 — 품절 상태 (sold_out_at 유무)
    is_watched: bool = False
    target_price: int | None = None  # v0.9.1 — device_id 조회 시 내 목표가
    # v0.4 — 가격 통계 (전체 기록 기준, 클라이언트는 '지금 사도 돼' 배지 등에 사용)
    min_price: int | None = None
    avg_price: int | None = None
    price_count: int = 0
    watch_count: int = 0  # 이 상품을 추적 중인 기기 수 (계정 규모 지표)
    # v0.13.0 (T-107) — 동일 상품 다른 몰 최저가 비교
    alternatives: list["ProductAlternativeOut"] = []


class ProductAlternativeOut(BaseModel):
    """크로스몰 비교 — 정규화명 동일 + 다른 몰 + 가격 근접 (±30%) 상품 (v0.13.0)"""

    product_id: str
    mall: str
    name: str | None
    image: str | None
    url: str
    last_price: int | None
    watch_count: int = 0
    diff_percent: int | None = None  # 이 상품 기준 같은 몰 대비 가격 차 (%) — 양수=더 저렴


class ProductBatchOut(BaseModel):
    upserted: int  # 상품 upsert 처리 건수
    price_count: int  # 가격 저장 건수
    items: list[ProductOut]  # 저장된 상품 목록 (중복 product_id dedup 후)


class PricePointOut(BaseModel):
    price: int
    source: str
    variant: str | None = None
    captured_at: datetime


class PriceStatsOut(BaseModel):
    """가격 통계 요약 (v0.10.0) — price_daily_stats 기반 주간/월간/역대 집계"""

    class PeriodStats(BaseModel):
        min: int | None = None
        min_date: date | None = None
        avg: int | None = None

    period7: PeriodStats = PeriodStats()
    period30: PeriodStats = PeriodStats()
    overall: PeriodStats = PeriodStats()
    # v0.13.0 (T-109) — 구매 타이밍 인사이트
    insight_badges: list[str] = []


class WatchIn(BaseModel):
    target_price: int | None = Field(None, gt=0, description="목표가 — 이 가격 이하 도달 시 target_reached 알림 (v0.9.1)")


class WatchOut(BaseModel):
    product_id: str
    mall: str | None = None
    product_name: str | None = None
    url: str | None = None
    image: str | None = None
    last_price: int | None = None
    last_checked_at: datetime | None = None  # 마지막 캡처 시각 — 방문 유도 배지용 (v0.4)
    sold_out: bool = False  # v0.9.1 — 품절 상태 (sold_out_at 유무)
    target_price: int | None = None  # v0.9.1 — 목표가
    created_at: datetime
    # v0.13.0 (T-107) — include_alternatives 옵션 시 동일 상품 다른 몰 비교
    alternatives: list["ProductAlternativeOut"] = []


class AlertOut(BaseModel):
    product_id: str
    alert_type: str  # price_dropped
    price: int
    previous_price: int | None
    captured_at: datetime


class AlertRecordIn(BaseModel):
    product_id: str
    alert_type: str  # price_dropped | target_reached | sold_out
    price: int = Field(..., ge=0)  # sold_out은 0
    previous_price: int | None = None


class AlertHistoryOut(BaseModel):
    id: int
    product_id: str
    product_name: str | None = None
    mall: str | None = None
    image: str | None = None
    alert_type: str
    price: int
    previous_price: int | None
    url: str | None
    created_at: datetime


class RecommendationOut(ProductOut):
    """추천 상품 — ProductOut + 기간 내 하락폭 (T-58, v0.7.2 할인율% 추가)"""
    drop_amount: int
    previous_price: int
    drop_percent: float = 0.0  # 할인율 % (previous 대비)
