# Pydantic 스키마 — API 요청/응답
# PLATFORM: server
from datetime import datetime

from pydantic import BaseModel, Field


class DeviceOut(BaseModel):
    device_id: str


class ProductUpsertIn(BaseModel):
    product_id: str = Field(..., max_length=255)
    mall: str = Field(..., max_length=32)
    url: str = Field(..., max_length=1024)
    name: str | None = None
    image: str | None = None


class PriceUploadIn(BaseModel):
    price: int = Field(..., gt=0)
    source: str = Field("client", max_length=16)  # client | crawler


class ProductOut(BaseModel):
    product_id: str
    mall: str
    url: str
    name: str | None
    image: str | None
    last_price: int | None
    last_checked_at: datetime | None
    is_watched: bool = False
    target_price: int | None = None


class PricePointOut(BaseModel):
    price: int
    source: str
    captured_at: datetime


class WatchIn(BaseModel):
    target_price: int | None = Field(None, gt=0)


class WatchOut(BaseModel):
    product_id: str
    target_price: int | None
    created_at: datetime


class AlertOut(BaseModel):
    product_id: str
    alert_type: str  # price_dropped | target_reached
    price: int
    previous_price: int | None
    captured_at: datetime
