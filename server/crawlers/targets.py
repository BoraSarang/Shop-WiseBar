# 수집 대상 목록 페이지 파싱 (v0.16.16, T-127) — 네이버 메인/올리브영 랭킹 등에서
# 상품 카드(product_id/name/price/url)를 추출해 신규 등록 또는 기존 상품 가격 갱신.
# worker.run_targets_once()가 enabled target을 순회하며 호출한다.
#
# 목록 페이지 특성상 개별 상품 페이지처럼 정밀한 fetch 대신:
#   - 카드 링크 href에서 상품 URL/ID 추출 (몰별 패턴)
#   - 각 카드 영역의 텍스트에서 이름/가격 파싱
# 실패(캡차/차단)는 사유 dict로 반환 — run_targets_once가 이력에 기록하고 다음 target 진행.
# PLATFORM: server
import logging
import re
from datetime import datetime, timezone

from sqlalchemy import select

from app.database import SessionLocal
from app.datetimeutil import KST
from app.models import CrawlTarget, PriceDailyStat, PricePoint, Product
from crawlers._browser import close_context, new_context

logger = logging.getLogger("crawler")

# 올리브영/네이버 크롤러와 동일한 Chrome UA (챌린지 회피 실측)
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

PRICE_RE = re.compile(r"([0-9][0-9,]*)\s*원")
# 올리브영 상품 링크 패턴 — /store/goods/getGoodsDetail.do?goodsNo={AB+12}
_OY_GOODS_RE = re.compile(r"[?&]goodsNo=([AB]\d{12})")
# 네이버 브랜드스토어/스마트스토어 상품 링크 — nid/도메인 경로 카드
_NAVER_LINK_RE = re.compile(r"(https://[a-z0-9.]*(?:brand\.naver\.com|smartstore\.naver\.com)/[^\s\"'<>]+)")


def _extract_products(page, url: str, mall: str) -> tuple[list[dict], str | None]:
    """목록 페이지 body에서 상품 카드 후보 추출.

    반환: (products, error) — products 항목 {product_id, mall, url, name, price}.
    차단(캡차) 감지 시 ([], 사유) 반환.
    """
    try:
        body = page.evaluate("document.body ? document.body.innerText : ''")
        html = page.evaluate("document.body ? document.body.innerHTML : ''")
    except Exception as exc:  # noqa: BLE001
        return [], f"페이지 파싱 실패: {type(exc).__name__}"

    # 챌린지/캡차 감지 — 개별 fetch와 동일한 판정
    if any(k in body for k in ("보안 확인", "완료하세요", "캡차", "잠시만 기다려 주세요", "접속 정보를 확인")) or "captcha" in body.lower():
        return [], "챌린지/캡차 차단"

    products: dict[str, dict] = {}

    if mall == "oliveyoung":
        # 올리브영 랭킹 — 카드 <a href>에서 goodsNo 추출, 가까운 카드 블록에서 이름/가격
        for m in re.finditer(r'<a[^>]+href="([^"]*goodsNo=[AB]\d{12}[^"]*)"[^>]*>(.*?)</a>', html, re.S | re.I):
            goods_no = None
            gm = _OY_GOODS_RE.search(m.group(1))
            if not gm:
                continue
            goods_no = gm.group(1)
            if goods_no in products:
                continue
            name = re.sub(r"<[^>]+>", " ", m.group(2))
            name = re.sub(r"\s+", " ", name).strip()
            price = _extract_price(name)  # 앵커 텍스트 안 가격 (없으면 카드 본문에서 시도)
            products[goods_no] = {
                "product_id": goods_no,
                "mall": "oliveyoung",
                "url": f"https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo={goods_no}",
                "name": name[:120] or goods_no,
                "price": price,
            }
    elif mall == "naver":
        # 네이버 메인/브랜드스토어 — 카드 앵커에서 상품 URL + 이름 추출
        for m in re.finditer(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', html, re.S | re.I):
            href = m.group(1)
            link = _NAVER_LINK_RE.search(href)
            if not link:
                continue
            full = link.group(1)
            name = re.sub(r"<[^>]+>", " ", m.group(2))
            name = re.sub(r"\s+", " ", name).strip()
            if not name or len(name) < 3:
                continue
            # product_id = URL 마지막 경로 세그먼트 (사이트별 상품 ID 역할)
            pid = full.rstrip("/").rsplit("/", 1)[-1].split("?")[0]
            if not pid or pid in products:
                continue
            products[pid] = {
                "product_id": f"naver:{pid}",
                "mall": "naver",
                "url": full,
                "name": name[:120],
                "price": _extract_price(name),
            }
    else:
        # custom — 일반적인 목록 페이지: 모든 외부 앵커 수집 (몰 미판정)
        for m in re.finditer(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', html, re.S | re.I):
            href = m.group(1)
            if not href.startswith("http"):
                continue
            name = re.sub(r"<[^>]+>", " ", m.group(2))
            name = re.sub(r"\s+", " ", name).strip()
            if not name or len(name) < 3:
                continue
            pid = f"custom:{hash(href) % (10 ** 10)}"
            if pid in products:
                continue
            products[pid] = {
                "product_id": pid,
                "mall": "custom",
                "url": href,
                "name": name[:120],
                "price": _extract_price(name),
            }

    return list(products.values()), None


def _extract_price(text: str) -> int | None:
    m = PRICE_RE.search(text)
    if not m:
        return None
    return int(m.group(1).replace(",", ""))


def _upsert(db, product_id: str, mall: str, url: str, name: str, image: str | None = None) -> Product:
    product = db.get(Product, product_id)
    if product is None:
        product = Product(id=product_id, mall=mall, url=url, name=name, image=image)
        db.add(product)
        db.flush()
    else:
        if not product.name:
            product.name = name
        if image:
            product.image = image
    return product


def _apply_price(db, product: Product, price: int, source: str = "crawler") -> None:
    """기존 크롤러와 동일한 가격 기록 코어 — price_daily_stats 집계 포함."""
    now = datetime.now(timezone.utc).replace(microsecond=0)
    today = now.astimezone(KST).date()
    last = db.scalar(
        select(PricePoint)
        .where(PricePoint.product_id == product.id, PricePoint.variant.is_(None))
        .order_by(PricePoint.captured_at.desc())
        .limit(1)
    )
    if last is None or last.price != price:
        db.add(PricePoint(product_id=product.id, price=price, source=source, captured_at=now))
    product.last_price = price
    product.last_checked_at = now
    if product.sold_out_at is not None:
        product.sold_out_at = None
        product.back_on_sale_at = now
    stat = db.scalar(
        select(PriceDailyStat)
        .where(PriceDailyStat.product_id == product.id, PriceDailyStat.stat_date == today)
    )
    if stat is None:
        stat = PriceDailyStat(
            product_id=product.id,
            stat_date=today,
            open_price=price, close_price=price, low_price=price, high_price=price,
            point_count=1, updated_at=now,
        )
        db.add(stat)
    else:
        stat.close_price = price
        stat.low_price = min(stat.low_price, price)
        stat.high_price = max(stat.high_price, price)
        stat.point_count += 1
        stat.updated_at = now


def run_target_once(target: CrawlTarget) -> dict:
    """대상 목록 페이지 1건 파싱 → 상품 등록/갱신.

    반환: {success: bool, count: int, error: str|None}
    """
    try:
        ctx = new_context(user_agent=UA, locale="ko-KR")
        try:
            page = ctx.new_page()
            try:
                page.goto(target.url, wait_until="networkidle", timeout=45000)
            except Exception:
                try:
                    page.goto(target.url, wait_until="domcontentloaded", timeout=30000)
                except Exception as exc:  # noqa: BLE001
                    return {"success": False, "count": 0, "error": f"페이지 로드 실패: {type(exc).__name__}"}
            products, error = _extract_products(page, target.url, target.mall)
            if error:
                return {"success": False, "count": 0, "error": error}
        finally:
            close_context(ctx)
    except Exception as exc:  # noqa: BLE001 — 컨텍스트 생성 실패 격리
        return {"success": False, "count": 0, "error": f"브라우저 오류: {type(exc).__name__}"}

    if not products:
        return {"success": True, "count": 0, "error": None}

    upserted = 0
    priced = 0
    with SessionLocal() as db:
        for p in products:
            try:
                product = _upsert(db, p["product_id"], p["mall"], p["url"], p["name"])
                if p["price"]:
                    _apply_price(db, product, p["price"])
                    priced += 1
                upserted += 1
            except Exception as exc:  # noqa: BLE001 — 개별 항목 실패는 스킵
                logger.warning("target 상품 처리 실패 %s: %s", p["product_id"], type(exc).__name__)
        db.commit()
    logger.info("target %s(%s): %d건 등록/갱신 / %d건 가격 기록", target.label, target.mall, upserted, priced)
    return {"success": True, "count": upserted, "error": None}