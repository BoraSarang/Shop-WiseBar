# 상품명 정규화 — 크로스몰 동일상품 매칭용 (v0.13.0, T-106)
# 몰별 표기 차이(괄호·불용어·공백·대소문자)를 제거해 "같은 상품"을 같은 키로 만든다.
# 규칙은 몰마다 다른 상품명 표기를 최소한의 차이로 합치는 실용적 수준 (D5).
# PLATFORM: server
import re

# 몰별 표기 차이·판매 문구 불용어 — 토큰 단위로 제거 (매칭 정확도 저하 방지)
_STOPWORDS = {
    "세트",
    "구성",
    "패키지",
    "특가",
    "기획전",
    "선물",
    "포장",
    "정품",
    "선물용",
    "구매",
    "상품",
    "글번호",
    "바겐",
    "데일리",
    "미니멀",
}

# 알파벳/숫자/한글/공백만 남기고 나머지(괄호·기호·단위 분리 문자 등)는 공백으로 치환
_TOKEN_PATTERN = re.compile(r"[^가-힣a-zA-Z0-9]+")


def normalize(name: str | None) -> str | None:
    """정규화 상품명. 의미 없는/비어 있으면 None (매칭 제외)"""
    if not name:
        return None
    low = name.lower()
    tokens = _TOKEN_PATTERN.split(low)
    kept = [t for t in tokens if t and t not in _STOPWORDS]
    if not kept:
        return None
    # 토큰 집합 대신 순서 유지 문자열 — "갤럭시 s25 울트라" vs "s25 울트라 갤럭시"는 다르게 취급
    return " ".join(kept)


def is_same_product(a: str | None, b: str | None) -> bool:
    """정규화 키 동일 여부 (조건 컬럼 연산과 병행하는輔助 함수)"""
    if not a or not b:
        return False
    return a == b