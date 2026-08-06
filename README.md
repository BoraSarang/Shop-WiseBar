<p align="center">
  <img src="extension/icons/icon128.png" width="96" alt="똑바 로고" />
</p>

<h1 align="center">똑바 · Shop WiseBar</h1>

<p align="center">
  쇼핑몰 상품의 가격을 자동으로 추적하고, 내려가면 바로 알려드려요.<br/>
  네이버 · 쿠팡 · 올리브영 어디서든 <strong>지금 사도 되는 가격</strong>을 놓치지 마세요.
</p>

<p align="center">
  <a href="https://borasarang.github.io/Shop-WiseBar/">랜딩 페이지</a> ·
  <a href="releases/latest">릴리스</a> ·
  <a href="docs/PRD.md">PRD</a> ·
  <a href="docs/DESIGN.md">기술 설계</a> ·
  <a href="docs/store/STORE_LISTING.md">스토어 리스팅</a>
</p>

<p align="center">
  <b>Chrome</b> MV3 확장 · <b>웨일(Whale)</b> 스토어 등록 진행 중 (v0.12.2)
</p>

---

## 소개

똑바는 브라우저 확장이 여러분이 보는 상품 페이지에서 가격을 자동으로 수집하고,
서버가 가격 이력을 쌓아 **하락 감지**와 **목표가 도달 알림**을 보내는 가격 변동 추적 도구입니다.

- 방문한 상품의 가격을 **자동으로 기록** — 별도 버튼을 눌러 저장할 필요 없음 (10분 쿨다운)
- **찜 + 목표가 설정** → 가격이 내리거나 목표가에 도달하면 **브라우저 알림**
- **가격 추이 그래프**로 지금이 구매 타이밍인지 판단 (7일/2주/1달)
- **함께 본 상품 · 오늘의 핫딜** 추천
- 익명 기기ID 기반이라 **계정·개인정보 없이** 시작

## 지원 쇼핑몰

| 몰 | URL | productID 규약 |
|----|-----|----------------|
| 네이버+ 스토어 | `shopping.naver.com/{store}/products/{id}` | `store:{store}:{id}` |
| 네이버 브랜드 | `brand.naver.com/{store}/products/{id}` | `brand:{store}:{id}` |
| 네이버 쇼핑 카탈로그 | `search.shopping.naver.com/catalog/{id}` | `c:{id}` |
| 쿠팡 | `coupang.com/vp/products/{id}` | `{id}` |
| 올리브영 | `oliveyoung.co.kr/...?goodsNo={no}` | `{no}` |

## 설치 방법

### 웨일 스토어 (심사 등록 진행 중 — T-96)

- [웨일 스토어](https://store.whale.naver.com/)에 **똑바** 등록 심사가 진행 중입니다 (v0.12.2).
- 승인 후 스토어에서 "똑바"로 검색해 설치할 수 있습니다.

### Chrome / Edge / Whale (개발자 모드)

1. 이 저장소를 `git clone` 하거나 **Code → Download ZIP**으로 받습니다.
2. 주소창에 `chrome://extensions` 입력 후 **개발자 모드**를 켭니다.
3. **압축해제된 확장 프로그램을 로드합니다**를 눌러 `extension/` 폴더를 선택합니다.
4. 상품 페이지(네이버·쿠팡·올리브영)로 이동하면 똑바 버튼이 나타납니다.

> Chrome·엣지·웨일 모두 manifest 그대로 로드할 수 있습니다 (MV3).

## 기능

- **자동 가격 수집** — 네이버/쿠팡은 확장이 유일한 자동 수집 채널입니다 (서버는 캡차/Akamai로 직접 수집 불가). 많은 사용자가 방문할수록 서버 데이터가 누적됩니다.
- **찜 목록 & 팝업 가격 추이** — 캔버스 기반 가격 이력 그래프, 목표가 설정/해제
- **알림** — 하락 / 목표가 도달 두 종류 (팝업에서 최근 알림 확인)
- **플로팅 패널** — 상품 페이지 우하단 FAB 클릭 시 메뉴 5개: 오늘의 핫딜 · 알림 · 가격 추이 · 찜 목록 · 설정
- **팝업** — 현재 상품 정보/가격 추이 + 오늘의 핫딜(1일/7일/30일) + 함께 본 상품

## 아키텍처

```
브라우저 익스텐션 (MV3)                 중앙 서버 (FastAPI + SQLite)
┌─────────────────────────┐    HTTPS    ┌──────────────────────────────┐
│ content script ─ 가격추출 │ ──────────▶ │ price_points (가격 이력)      │
│ background ─ 수집/알림/팝업│            │ watches (찜+목표가)            │
│ popup ─ 찜/추이/핫딜      │ ◀────────── │ alerts (하락/목표가 검출)     │
└─────────────────────────┘   알림 폴링  │ product_relations (함께 본 상품)│
                                         └──────────────────────────────┘
```

- 수집 우선순위: ①서버 크롤러(올리브영 Playwright) ②익스텐션(네이버/쿠팡/올리브영)
- 멀티 사용자 공유 — 상품/가격 데이터는 익명(서버 공유), 찜/알림은 기기별 격리

## 개발

### 로컬 서버

```bash
cd server && .venv/bin/uvicorn app.main:app --port 8000
# API 명세(Swagger): http://127.0.0.1:8000/docs
```

### 확장 로드

- Chrome `chrome://extensions` → 개발자 모드 → `extension/` 로드
- 서버 URL은 `extension/common.js`의 `SWB_CONFIG`에서 단일 관리 (업데이트로 자동 반영)

### 스토어 패키징 / 스크린샷

```bash
# 스토어 배포 zip 생성 (dist/shop-wisebar-v{version}.zip)
./scripts/webstore-publish.sh --dry-run

# 웨일 심사용 스크린샷 5장 자동 캡처 + 온보딩 이미지 자동 갱신 (macOS + 웨일)
cd scripts/store-capture && node capture.js
```

- 상세: `docs/store/SCREENSHOT_GUIDE.md`, `docs/store/STORE_LISTING.md`

### 브랜치/커밋 규약

```bash
feat(extension): ...   # `feat(server): ...` 등
```

## 문의

- 제작자: BoRaSaRang
- 문의: <a href="mailto:leeborasarang@gmail.com">leeborasarang@gmail.com</a>

<p align="center">똑바 · 최저가를 놓치지 마세요</p>