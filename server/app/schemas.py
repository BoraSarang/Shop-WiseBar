# Pydantic 스키마 — API 요청/응답
# PLATFORM: server
from datetime import datetime

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


class PriceUploadIn(BaseModel):
    price: int = Field(..., gt=0)
    source: str = Field("client", max_length=16)  # client | crawler | extension
    variant: str | None = Field(None, max_length=128)  # 쿠팡 옵션(itemId) — 옵션별 가격 분리용


class ProductOut(BaseModel):
    product_id: str
    mall: str
    url: str
    name: str | None
    image: str | None
    last_price: int | None
    last_checked_at: datetime | None
    is_watched: bool = False


class PricePointOut(BaseModel):
    price: int
    source: str
    variant: str | None = None
    captured_at: datetime


class WatchIn(BaseModel):
    pass


class WatchOut(BaseModel):
    product_id: str
    mall: str | None = None
    product_name: str | None = None
    url: str | None = None
    image: str | None = None
    last_price: int | None = None
    created_at: datetime


class AlertOut(BaseModel):
    product_id: str
    alert_type: str  # price_dropped
    price: int
    previous_price: int | None
    captured_at: datetime


class AlertRecordIn(BaseModel):
    product_id: str
    alert_type: str  # price_dropped
    price: int = Field(..., gt=0)
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
    """추천 상품 — ProductOut + 기간 내 하락폭 (T-58)"""
    drop_amount: int
    previous_price: int
