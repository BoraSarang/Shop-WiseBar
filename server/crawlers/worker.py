# 크롤러 워커 (P5-T55) — 갱신이 오래된 올리브영 상품 자동 수집
# 실행: `python run_crawler.py` (uvicorn과 별도 프로세스)
# 주기: 30분, 배치: 상품 10개/회 (last_checked_at 오래된 순)
# PLATFORM: server
import logging
import time
from datetime import datetime, timezone

from sqlalchemy import select

from app.database import SessionLocal
from app.models import PricePoint, Product
from crawlers.oliveyoung import fetch_goods

logging.basicConfig(level=logging.INFO, format="%(asctime)s [CRAWLER] %(message)s")
logger = logging.getLogger("crawler")

BATCH_SIZE = 10
INTERVAL_SECONDS = 30 * 60
STALE_AFTER_SECONDS = 60 * 60  # 1시간 이상 지난 상품 대상

# 서버 크롤링 지원 몰 (브라우저 세션 불필요한 몰만 — 네이버/쿠팡은 클라이언트 업로드에 의존)
CRAWLABLE_MALLS = {"oliveyoung"}


def _fetch_and_save(product: Product) -> bool:
    if product.id.startswith("oyrun:"):
        # 단축 URL 해석은 클라이언트 전용 — goodsNo 형식만 크롤링
        return False
    result = fetch_goods(product.id)
    if result is None:
        return False
    with SessionLocal() as db:
        fresh = db.get(Product, product.id)
        if fresh is None:
            return False
        point = PricePoint(
            product_id=fresh.id,
            price=result["price"],
            source="crawler",
            captured_at=datetime.now(timezone.utc),
        )
        db.add(point)
        fresh.last_price = result["price"]
        fresh.last_checked_at = point.captured_at
        if result["name"] and not fresh.name:
            fresh.name = result["name"]
        if result["image"] and not fresh.image:
            fresh.image = result["image"]
        db.commit()
        logger.info("수집 완료: %s → %s원", fresh.id, result["price"])
        return True


def run_once() -> int:
    """갱신 만료된 올리브영 상품 1배치 수집. 성공 수 반환"""
    now = time.time()
    with SessionLocal() as db:
        candidates = db.scalars(
            select(Product)
            .where(Product.mall.in_(CRAWLABLE_MALLS))
            .order_by(Product.last_checked_at.asc().nulls_first())
            .limit(BATCH_SIZE * 3)
        ).all()

    stale = []
    for p in candidates:
        if p.last_checked_at is None:
            stale.append(p)
            continue
        if now - p.last_checked_at.timestamp() > STALE_AFTER_SECONDS:
            stale.append(p)

    success = 0
    for product in stale[:BATCH_SIZE]:
        if _fetch_and_save(product):
            success += 1
        time.sleep(1)  # 쇼핑몰 과부하 방지
    return success


def main() -> None:
    logger.info("크롤러 워커 시작 (주기 %ss, 배치 %d)", INTERVAL_SECONDS, BATCH_SIZE)
    while True:
        try:
            success = run_once()
            if success:
                logger.info("배치 완료: %d건 수집", success)
        except Exception:
            logger.exception("배치 실패")
        time.sleep(INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
