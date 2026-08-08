# ORM 모델 — Device(익명 기기ID) / Product(상품 마스터) / PricePoint(가격 이력) / Watch(관심 상품)
# v0.6.0: PriceDailyStat(일별 가격 통계) 추가 — 로우 데이터 축적 대신 일별 집계
# product.id는 클라이언트 MallParser의 productID 규약과 동일한 문자열 PK
#   coupang: 상품번호 / naver: "store:{store}:{id}" | "brand:{store}:{id}" | "c:{id}" / oliveyoung: goodsNo | "oyrun:{url}"
# PLATFORM: server
from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, UniqueConstraint
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
    normalized_name: Mapped[str | None] = mapped_column(String(512), nullable=True, index=True)  # v0.13.0 — 크로스몰 매칭용 정규화 상품명
    image: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    last_price: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sold_out_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)  # v0.9.1 — 품절 시작 시각 (None=판매중)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    price_points: Mapped[list["PricePoint"]] = relationship(back_populates="product", cascade="all, delete-orphan")


class PricePoint(Base):
    __tablename__ = "price_points"
    __table_args__ = (UniqueConstraint("product_id", "captured_at", name="uq_product_captured"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), index=True)
    variant: Mapped[str | None] = mapped_column(String(128), nullable=True)  # 쿠팡 옵션(itemId) 등 — 옵션별 가격 분리
    price: Mapped[int] = mapped_column(Integer)
    source: Mapped[str] = mapped_column(String(16), default="client")  # client | crawler
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    product: Mapped[Product] = relationship(back_populates="price_points")


class PriceDailyStat(Base):
    """일별 가격 통계 (v0.6.0) — 가격이 변했을 때만 price_points에 기록하고,
    방문(수집) 자체는 당일 통계에 집계한다. 그래프/요약은 이 테이블 사용.
    open: 하루 첫 수집 가격 / close: 하루 마지막 수집 가격 / low·high: 하루 최저·최고"""

    __tablename__ = "price_daily_stats"
    __table_args__ = (UniqueConstraint("product_id", "stat_date", name="uq_product_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), index=True)
    stat_date: Mapped[date] = mapped_column(Date, index=True)
    open_price: Mapped[int] = mapped_column(Integer)
    close_price: Mapped[int] = mapped_column(Integer)
    low_price: Mapped[int] = mapped_column(Integer)
    high_price: Mapped[int] = mapped_column(Integer)
    point_count: Mapped[int] = mapped_column(Integer, default=1)  # 당일 수집(방문) 횟수
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    product: Mapped[Product] = relationship()


class Watch(Base):
    __tablename__ = "watches"
    __table_args__ = (UniqueConstraint("device_id", "product_id", name="uq_device_product"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    device_id: Mapped[str] = mapped_column(ForeignKey("devices.id"), index=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), index=True)
    target_price: Mapped[int | None] = mapped_column(Integer, nullable=True)  # v0.9.1 — 목표가 (이하 도달 시 target_reached 알림)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    device: Mapped[Device] = relationship(back_populates="watches")
    product: Mapped[Product] = relationship()


class Alert(Base):
    """알림 히스토리 — 폴링에서 감지된 가격 하락 기록 (최신순 50건 보존)"""

    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    device_id: Mapped[str] = mapped_column(ForeignKey("devices.id"), index=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), index=True)
    alert_type: Mapped[str] = mapped_column(String(32))  # price_dropped
    price: Mapped[int] = mapped_column(Integer)
    previous_price: Mapped[int | None] = mapped_column(Integer, nullable=True)
    url: Mapped[str | None] = mapped_column(String(1024), nullable=True)  # 상품 링크 스냅샷
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    device: Mapped[Device] = relationship()


class ProductRelation(Base):
    """상품 간 연관 관계 (Phase 3, v0.9.0) — 상품 페이지의 연관/추천 섹션에서 함께 노출된
    상품을 기록. 같은 쌍이 반복 등장하면 weight 증가 (연관 강도). 무방향 그래프로 취급:
    조회 시 source OR target 양방향 매칭"""

    __tablename__ = "product_relations"
    __table_args__ = (UniqueConstraint("source_product_id", "target_product_id", "kind", name="uq_rel_pair"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), index=True)
    target_product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), index=True)
    kind: Mapped[str] = mapped_column(String(16), default="related")
    weight: Mapped[int] = mapped_column(Integer, default=1)  # 함께 등장한 횟수
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
