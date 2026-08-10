# 올리브영 Playwright 크롤러 (v0.16.7) — HTTP 요청은 TLS 핑거프린팅으로 403 (실측) → headless Chrome으로 교체
# 파싱: og 태그(이름/이미지) + body 텍스트 가격 패턴
# 실측 PoC (2026-08-03): channel="chrome" headless로 가격 39,900원 + og:title/og:image 수집 성공
# 네이버/쿠팡은 서버 크롤링 불가(캡차/Akamai) — 익스텐션 업로드에 의존 (PRD 2장)
# v0.16.7 (T-120i): 소멸 상품(판매종료) 감지 — 반환 dict에 status 추가. run_once는 gone이면
#   last_checked_at 갱신만 해 다음 배치 재시도 방지 (운영: 소멸 상품이 1시간마다 0건 반복 실측).
# PLATFORM: server
import logging
import re
import time
from datetime import datetime, timedelta, timezone

from app.database import SessionLocal
from app.models import PricePoint, Product
from crawlers._browser import new_context

logger = logging.getLogger("crawler")

# 실측: 기본 UA는 Cloudflare 챌린지("잠시만 기다리십시오") 차단, Chrome UA로 통과
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

# 소멸 페이지 표식 (운영·로컬 실측): og:title="올리브영 온라인몰" + body "찾을 수 없"
_GONE_TITLE = "올리브영 온라인몰"


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
            page.goto(url, wait_until="domcontentloaded", timeout=60000)
        except Exception as exc:  # noqa: BLE001 — 타임아웃 등이어도 아래 렌더 대기로 커버
            logger.warning("올리브영 goto 지연 goodsNo=%s: %s (렌더 대기 지속)", goods_no, type(exc).__name__)
        body_text = ""
        # 챌린지 자동 해결 + SPA 렌더 대기 — 미국 IP는 해결이 느리므로 8회(40s)까지 (v0.16.9)
        for _ in range(8):
            try:
                page.wait_for_timeout(5000)
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
            ctx.close()
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
        ctx.close()  # 컨텍스트 누적으로 인한 메모리 누적 방지 (운영 OOM 대응)

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
        ctx.close()

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
        if not price:
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


def run_once() -> tuple[int, int, int, str | None]:
    """갱신 만료된 올리브영 상품 1배치 수집.

    반환: (attempted, success, gone, error) — v0.16.8 (T-121):
      attempted 시도 건수 / success 성공 건수 / gone 상품없음(소멸) 건수 / error 실패 사유(없으면 None).
    실패 = attempted - success - gone (fetch 불가·일시 오류 — 다음 배치에서 재시도).
    """
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

    attempted = 0
    success = 0
    gone = 0
    errors: list[str] = []
    for product in stale[:6]:  # 배치 6건 — v0.16.5(3건)→v0.16.9 확대: 순차·컨텍스트 1개 + 리소스차단이라 메모리 안전, 소멸 소진 2배 속도
        if product.id.startswith("oyrun:"):
            continue
        attempted += 1  # 실제 fetch 시도 1건
        result = fetch_goods(product.id)
        if result is None or result.get("status") is None:
            errors.append(result["error"] if result else "알 수 없는 오류")
            continue  # 일시 오류 — 다음 배치에서 재시도
        if result["status"] == "gone":
            gone += 1  # 소멸(판매종료) 건수 — 실패로 취급하지 않음 (v0.16.8)
            # 소멸 확정 상품은 7일 후에만 재확인 (v0.16.9) — 
            #   기존 60분마다 스테일로 부활해 소멸 상품이 배치를 계속 점유하는 문제 해결.
            #   판매 재개 시 7일 내 자동 감지된다 (fetch → ok 가격 수집 → last_checked_at 갱신).
            with SessionLocal() as db:
                fresh = db.get(Product, product.id)
                if fresh is None:
                    continue
                fresh.last_checked_at = datetime.now(timezone.utc) + timedelta(days=7)
                db.commit()
            continue
        with SessionLocal() as db:
            fresh = db.get(Product, product.id)
            if fresh is None:
                continue
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
            print(f"수집 완료: {fresh.id} → {result['price']}원")
            success += 1
    return attempted, success, gone, "; ".join(dict.fromkeys(errors)) or None
