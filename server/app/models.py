# ORM 모델 — Device(익명 기기ID) / Product(상품 마스터) / PricePoint(가격 이력) / Watch(관심 상품)
# product.id는 클라이언트 MallParser의 productID 규약과 동일한 문자열 PK
#   coupang: 상품번호 / naver: "store:{store}:{id}" | "brand:{store}:{id}" | "c:{id}" / oliveyoung: goodsNo | "oyrun:{url}"
# PLATFORM: server
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)  # 익명 UUID
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    watches: Mapped[list["Watch"]] = relationship(back_populates="device", cascade="all, delete-orphan")


class Product(Base):
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)  # 클라이언트 productID 규약
    mall: Mapped[str] = mapped_column(String(32), index=True)  # coupang | naver | oliveyoung
    url: Mapped[str] = mapped_column(String(1024))
    name: Mapped[str | None] = mapped_column(String(512), nullable=True)
    image: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    last_price: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    price_points: Mapped[list["PricePoint"]] = relationship(back_populates="product", cascade="all, delete-orphan")


class PricePoint(Base):
    __tablename__ = "price_points"
    __table_args__ = (UniqueConstraint("product_id", "captured_at", name="uq_product_captured"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), index=True)
    price: Mapped[int] = mapped_column(Integer)
    source: Mapped[str] = mapped_column(String(16), default="client")  # client | crawler
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    product: Mapped[Product] = relationship(back_populates="price_points")


class Watch(Base):
    __tablename__ = "watches"
    __table_args__ = (UniqueConstraint("device_id", "product_id", name="uq_device_product"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    device_id: Mapped[str] = mapped_column(ForeignKey("devices.id"), index=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), index=True)
    target_price: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 목표가 (이하 도달 시 알림)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    device: Mapped[Device] = relationship(back_populates="watches")
    product: Mapped[Product] = relationship()


class Alert(Base):
    """알림 히스토리 — 폴링에서 감지된 하락/목표 도달 기록 (최신순 50건 보존)"""

    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    device_id: Mapped[str] = mapped_column(ForeignKey("devices.id"), index=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), index=True)
    alert_type: Mapped[str] = mapped_column(String(32))  # price_dropped | target_reached
    price: Mapped[int] = mapped_column(Integer)
    previous_price: Mapped[int | None] = mapped_column(Integer, nullable=True)
    url: Mapped[str | None] = mapped_column(String(1024), nullable=True)  # 상품 링크 스냅샷
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    device: Mapped[Device] = relationship()
