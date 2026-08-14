# 올리브영 Playwright 크롤러 (v0.16.7) — HTTP 요청은 TLS 핑거프린팅으로 403 (실측) → headless Chrome으로 교체
# 파싱: og 태그(이름/이미지) + body 텍스트 가격 패턴
# 실측 PoC (2026-08-03): channel="chrome" headless로 가격 39,900원 + og:title/og:image 수집 성공
# 네이버/쿠팡은 서버 크롤링 불가(캡차/Akamai) — 익스텐션 업로드에 의존 (PRD 2장)
# v0.16.7 (T-120i): 소멸 상품(판매종료) 감지 — 반환 dict에 status 추가. run_once는 gone이면
#   last_checked_at 갱신만 해 다음 배치 재시도 방지 (운영: 소멸 상품이 1시간마다 0건 반복 실측).
# PLATFORM: server
import logging
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

from app.database import SessionLocal
from app.models import PricePoint, Product
from crawlers._browser import close_browser, close_context, new_context

logger = logging.getLogger("crawler")

# 실측: 기본 UA는 Cloudflare 챌린지("잠시만 기다리십시오") 차단, Chrome UA로 통과
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

# 소멸 페이지 표식 (운영·로컬 실측): og:title="올리브영 온라인몰" + body "찾을 수 없"
_GONE_TITLE = "올리브영 온라인몰"

# 가격 오탐 방어 (v0.16.17) — body 첫 "N원" 매칭이 적립금/포인트 등 4원 같은
# 실제가 아닌 값을 잡는 사례(운영 실측 2026-08-14)가 있어 1,000원 미만은 폐기한다.
MIN_PRICE = 1_000


def _open_goods_page(goods_no: str, url: str) -> tuple | None:
    """상품 페이지를 열고 (context, page, body_text) 반환 — goto 실패해도 렌더 대기 지속.

    v0.16.9 (T-122c): 미국 IP에서 domcontentloaded가 30초를 넘겨 goto 타임아웃 반복 실측.
      → timeout 60초 + goto 예외를 무시하고 렌더 대기 루프를 계속 진행 (페이지가 늦게 로드되는
        Cloudflare 챌린지 대응). 컨텍스트 닫기는 호출자가 finally로 처리.
    반환: (ctx, page, body_text). 실패 시 None (호출자는 브라우저 오류로 처리).
    """
    try:
        ctx = new_context(user_agent=UA, locale="ko-KR")
    except Exception as exc:
        logger.warning("올리브영 컨텍스트 생성 실패 goodsNo=%s: %s", goods_no, exc)
        return None
    try:
        page = ctx.new_page()
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
        except Exception as exc:  # noqa: BLE001 — 타임아웃 등이어도 아래 렌더 대기로 커버
            logger.warning("올리브영 goto 지연 goodsNo=%s: %s (렌더 대기 지속)", goods_no, type(exc).__name__)
        body_text = ""
        # 챌린지 자동 해결 + SPA 렌더 대기 — 미국 IP는 해결이 느리지만 4회(12s)까지만 (v0.16.10, 512MB OOM 방지)
        # v0.16.17: 폴링 5s → 3s — 정상 페이지는 1차 폴링에 바로 진행(실측 평균 13s/건 → 단축)
        for _ in range(4):
            try:
                page.wait_for_timeout(3000)
                body_text = page.evaluate("document.body ? document.body.innerText : ''")
            except Exception as exc:  # noqa: BLE001 — 페이지 재생성 등 일시 상태
                logger.warning("올리브영 렌더 대기 예외 goodsNo=%s (%d회): %s", goods_no, _ + 1, type(exc).__name__)
                continue
            challenge = "잠시만 기다려" in body_text or "접속 정보를 확인" in body_text
            if not challenge:
                break
            logger.info("올리브영 챌린지 대기 중 goodsNo=%s (%d회)", goods_no, _ + 1)
        return ctx, page, body_text
    except Exception as exc:
        try:
            close_context(ctx)
        except Exception:  # noqa: BLE001
            pass
        logger.warning("올리브영 페이지 열기 실패 goodsNo=%s: %s", goods_no, exc)
        return None


def _read_meta(page) -> tuple[str | None, str | None]:
    """og:title / og:image 메타 추출 — 페이지가 닫혀 있으면 None."""
    try:
        name_match = page.query_selector('meta[property="og:title"]')
        image_match = page.query_selector('meta[property="og:image"]')
        name = name_match.get_attribute("content") if name_match else None
        image = image_match.get_attribute("content") if image_match else None
    except Exception:  # noqa: BLE001 — 페이지 파손 시 None 처리
        return None, None
    return name, image


def fetch_goods(goods_no: str) -> dict | None:
    """올리브영 goodsNo → {status: "ok", name, price, image} | {status:"gone"} | {status:None, error} | None.

    status:
      "ok"    — 정상 수집
      "gone"  — 판매종료/삭제 상품 (다음 배치 재시도 방지하려면 last_checked_at 갱신)
      None    — 일시 오류/차단 — dict에 error 사유 포함 (v0.16.8, T-121)
    실패 시에도 None 대신 dict를 반환해 run_once가 **실패 사유**를 이력에 기록한다.

    Cloudflare 챌린지 대응 (v0.16.6→v0.16.9): "잠시만 기다려 주세요... 접속 정보를 확인 중" 페이지가
    뜨면 JS 챌린지 자동 해결까지 5초 간격 최대 6회 재대기. goto 타임아웃(미국 IP 30s 초과 실측)도
    렌더 대기로 커버.
    """
    url = (
        "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do"
        f"?goodsNo={goods_no}"
    )
    opened = _open_goods_page(goods_no, url)
    if opened is None:
        return {"status": None, "error": f"브라우저 오류: 페이지 열기 실패"}
    ctx, page, body_text = opened
    try:
        name, image = _read_meta(page)
    finally:
        close_context(ctx)  # Browserless 재사용 컨텍스트는 닫지 않고 페이지만 정리 (v0.16.13)

    if not name:
        # 진단: og:title 없음 = 봇 챌린지 미해결/블록 페이지 등
        reason = f"og:title 없음 body={len(body_text)}자"
        logger.warning("올리브영 %s goodsNo=%s (%s...)", reason, goods_no, body_text[:60].replace("\n", " "))
        return {"status": None, "error": reason}

    # 소멸(판매종료) 감지 — og:title이 몰 페이지 제목이면 상품이 없음 (운영 실측)
    if name == _GONE_TITLE or "찾을 수 없" in body_text:
        logger.info("올리브영 소멸 상품(재시도 방지) goodsNo=%s", goods_no)
        return {"status": "gone"}

    # 가격: ① body "N,NNN원" ② tx_num ③ data-qa 할인가
    price = None
    m = re.search(r"([0-9][0-9,]*)\s*원", body_text)
    if m:
        price = int(m.group(1).replace(",", ""))
    if not price:
        tx = re.search(r'<em class="tx_num">([0-9,]+)</em>', body_text)
        if tx:
            price = int(tx.group(1).replace(",", ""))
    if price is not None and price < MIN_PRICE:
        # 오탐 가격(1,000원 미만)은 저장하지 않는다 — 실제가 아님 (v0.16.17)
        logger.warning("올리브영 가격 오탐 goodsNo=%s: %s원 (1,000원 미만) → 폐기 (%s)",
                       goods_no, price, body_text[:60].replace("\n", " "))
        return {"status": None, "error": f"가격 오탐(1,000원 미만): {price}원"}
    if not price:
        # 소멸/차단 판별: body가 180자 미만(헤더만 렌더)이면 상품 본문이 없는 페이지 →
        #   운영(미국 IP) 실측 body=160자로 "찾을 수 없" 문구가 잘려 없음 → 소멸로 판정 (v0.16.7)
        tiny = len(body_text) < 180
        logger.warning(
            "올리브영 가격 미발견 goodsNo=%s body=%d자(%s) (%s...)",
            goods_no, len(body_text), "tiny→소멸" if tiny else "본문↲오류",
            body_text[:60].replace("\n", " "),
        )
        if tiny:
            return {"status": "gone"}
        return {"status": None, "error": f"가격 미발견 body={len(body_text)}자"}

    return {
        "status": "ok",
        "name": name,
        "image": image,
        "price": price,
        "checked_at": time.time(),
    }


def fetch_goods_diag(goods_no: str) -> dict:
    """진단(T-122a): 단일 상품 렌더 결과 상세 — 미국 IP 오판 여부 확정용.

    fetch_goods가 내부에서 판단한 status/price 에 더해 원본 body_text 와 og:title 을
    반환해 "왜 gone/error 로 판정됐는지" 를 운영에서 바로 확인한다.
    반환: {goods_no, status, error, price, name, body_len, body_preview, title}
    """
    url = (
        "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do"
        f"?goodsNo={goods_no}"
    )
    opened = _open_goods_page(goods_no, url)
    if opened is None:
        return {"goods_no": goods_no, "status": None, "error": "브라우저 오류: 페이지 열기 실패"}
    ctx, page, body_text = opened
    try:
        og, image = _read_meta(page)
    finally:
        close_context(ctx)

    name = og
    status = None
    error = None
    price = None
    if not name:
        status, error = None, f"og:title 없음 body={len(body_text)}자"
    elif name == _GONE_TITLE or "찾을 수 없" in body_text:
        status = "gone"
    else:
        m = re.search(r"([0-9][0-9,]*)\s*원", body_text)
        if m:
            price = int(m.group(1).replace(",", ""))
        if not price:
            tx = re.search(r'<em class="tx_num">([0-9,]+)</em>', body_text)
            if tx:
                price = int(tx.group(1).replace(",", ""))
        if price is not None and price < MIN_PRICE:
            # 오탐 가격(1,000원 미만) — 저장 대상이 아님 (v0.16.17)
            logger.warning("올리브영 가격 오탐 goodsNo=%s: %s원 (1,000원 미만) → 폐기", goods_no, price)
            status, error = None, f"가격 오탐(1,000원 미만): {price}원"
        elif not price:
            tiny = len(body_text) < 180
            status, error = (("gone", None) if tiny else (None, f"가격 미발견 body={len(body_text)}자"))
        else:
            status = "ok"
    return {
        "goods_no": goods_no,
        "status": status,
        "error": error,
        "price": price,
        "name": name,
        "image": image,
        "body_len": len(body_text),
        "body_preview": body_text[:200].replace("\n", " "),
    }


def _parallel_workers() -> int:
    """병렬 fetch 워커 수 — 로컬 워커만 병렬 (Render 512MB 보호, v0.16.17).

    스레드마다 별도 Chrome이 뜨므로(스레드 로컬 브라우저) 수는 메모리와 타협.
    로컬 기본 3, Render 기본 1(순차).
    """
    if os.environ.get("LOCAL_WORKER") == "1":
        return int(os.environ.get("CRAWLER_PARALLEL", "3"))
    return 1


def _process(product: Product, index: int, total: int) -> tuple[str, str, float]:
    """단일 상품 fetch + DB 반영 — 병렬 워커 스레드에서 호출 (스레드 로컬 브라우저 + 새 세션이라 안전).

    반환: (result_kind, detail, dt) — result_kind: "ok" / "gone" / "error".
    """
    logger.info("올리브영 수집 시도 %d/%d goodsNo=%s", index, total, product.id)
    t0 = time.monotonic()
    result = fetch_goods(product.id)
    dt = time.monotonic() - t0
    if result is None or result.get("status") is None:
        err = result["error"] if result else "알 수 없는 오류"
        logger.warning("올리브영 수집 실패 %d/%d %s (%.1fs) — %s", index, total, product.id, dt, err)
        return ("error", err, dt)
    if result["status"] == "gone":
        logger.info("올리브영 소멸 %d/%d %s (%.1fs)", index, total, product.id, dt)
        # 소멸 확정 상품은 7일 후에만 재확인 (v0.16.9) — 배치 점유 방지
        with SessionLocal() as db:
            fresh = db.get(Product, product.id)
            if fresh is None:
                return ("error", "상품 삭제됨", dt)
            fresh.last_checked_at = datetime.now(timezone.utc) + timedelta(days=7)
            db.commit()
        return ("gone", product.id, dt)
    with SessionLocal() as db:
        fresh = db.get(Product, product.id)
        if fresh is None:
            return ("error", "상품 삭제됨", dt)
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
        logger.info("올리브영 수집 완료 %d/%d %s → %s원 (%.1fs)", index, total, fresh.id, result["price"], dt)
    return ("ok", fresh.id, dt)


def run_once() -> tuple[int, int, int, str | None]:
    """갱신 만료된 올리브영 상품 1배치 수집.

    반환: (attempted, success, gone, error) — v0.16.8 (T-121):
      attempted 시도 건수 / success 성공 건수 / gone 상품없음(소멸) 건수 / error 실패 사유(없으면 None).
    실패 = attempted - success - gone (fetch 불가·일시 오류 — 다음 배치에서 재시도).
    로컬 워커는 CRAWLER_PARALLEL(기본 3) 병렬 fetch (v0.16.17) — 배치 시간 1/2~1/3 단축.
    """
    # 배치 크기 — 기본 2건(Render 512MB OOM 방지, 운영 실측 2026-08-10).
    # 로컬 워커는 CRAWLER_BATCH_LIMIT로 확대 (시스템 Chrome + 메모리 제약 없음, v0.16.16).
    batch_limit = int(os.environ.get("CRAWLER_BATCH_LIMIT", "2"))
    now = time.time()
    with SessionLocal() as db:
        candidates = db.query(Product) \
            .filter(Product.mall == "oliveyoung") \
            .order_by(Product.last_checked_at.asc().nulls_first()) \
            .limit(10 * 3) \
            .all()

    stale = []
    for p in candidates:
        if p.last_checked_at is None:
            stale.append(p)
            continue
        if now - p.last_checked_at.timestamp() > 60 * 60:
            stale.append(p)

    batch = [p for p in stale[:batch_limit] if not p.id.startswith("oyrun:")]
    logger.info("올리브영 수집 대상 %d건 (스테일 %d건)", len(batch), len(stale))
    if not batch:
        return 0, 0, 0, None

    workers = _parallel_workers()
    indexed = list(enumerate(batch, start=1))
    total = len(batch)
    attempted = total
    success = 0
    gone = 0
    errors: list[str] = []

    def _collect(kind: str, detail: str) -> None:
        nonlocal success, gone
        if kind == "ok":
            success += 1
        elif kind == "gone":
            gone += 1
        else:
            errors.append(detail)

    if workers > 1:
        # 라운드로빈 청크 분배 — 스레드마다 자체 브라우저가 뜨므로 브라우저는 재사용하고
        # 청크 처리 후 해당 스레드의 리소스를 정리한다 (close_browser는 스레드 로컬).
        chunks = [indexed[i::workers] for i in range(workers)]

        def _run_chunk(chunk):
            try:
                return [_process(p, idx, total) for idx, p in chunk]
            finally:
                close_browser()  # 워커 스레드 브라우저 정리 (다음 배치에서 재생성)

        with ThreadPoolExecutor(max_workers=workers) as ex:
            futures = [ex.submit(_run_chunk, c) for c in chunks if c]
            for fut in futures:
                for kind, detail, _dt in fut.result():
                    _collect(kind, detail)
    else:
        for idx, product in indexed:
            _collect(*_process(product, idx, total)[:2])
    return attempted, success, gone, "; ".join(dict.fromkeys(errors)) or None
