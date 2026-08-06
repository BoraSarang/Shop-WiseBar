# 똑바(Shop WiseBar) 기술 설계 — v0.3.0

> 2026-08-03 재구성: 맥 메뉴바 앱 폐기, 중앙 서버 + 브라우저 익스텐션(Chrome MV3)

## 1. 전체 아키텍처

```
┌───────────────────────────┐
│ 브라우저 익스텐션 (MV3)    │
│  background (서비스 워커) │── 수집(탭 이벤트) ──┐
│  content script (DOM 추출)│                      ▼
│  popup (찜/추이/알림)      │── 폴링(alerts) ──▶ 중앙 서버 (FastAPI + SQLite)
└───────────────────────────┘  ┌────────────────┐
                                │ 올리브영 크롤러  │── 1순위 수집 (Playwright, 주기)
                                │ (worker)        │
                                └────────────────┘
```

## 2. 중앙 서버 (server/, FastAPI + SQLite — 재사용)

### 2.1 DB 스키마 (server/app/models.py)

| 테이블 | 컬럼 | 비고 |
|--------|------|------|
| `devices` | id (UUID PK), created_at | 익명 기기(익스텐션) |
| `products` | id (PK), mall, url, name, image, last_price, last_checked_at | productID 규약은 PRD 5장 |
| `price_points` | product_id, price, source, captured_at | source: `crawler` \| `extension` \| `client`(레거시) |
| `watches` | device_id, product_id, target_price, created_at | 기기별 찜 + 목표가 |

### 2.2 API (server/app/routers/, prefix `/api/v1`)

| 엔드포인트 | 역할 | 사용 주체 |
|-----------|------|-----------|
| `POST /devices` | 익스텐션 기기ID 발급 | 익스텐션 최초 실행 |
| `POST /products` | 상품 upsert (name/image/url) | 익스텐션 수집 |
| `POST /products/{id}/prices` | 가격 이력 추가 (source=extension) | 익스텐션 수집 |
| `GET /products/{id}` / `/products/{id}/prices` | 상품/가격 이력 조회 | 팝업 |
| `PUT/DELETE /devices/{id}/watches/{pid}` | 찜 추가/해제 (+목표가) | 팝업 |
| `GET /devices/{id}/watches` | 내 찜 목록 | 팝업 |
| `GET /devices/{id}/alerts?since=` | 가격 변동/목표가 도달 알림 | 익스텐션 폴링 |
| `GET /recommendations` | 공통 추천 (추후) | 팝업 |

### 2.3 알림 계산 (서버 로직, 기존 유지)

- 가격이 직전 `price_points` 대비 하락하면 `alerts`에 `PRICE_DROP` 기록
- `watches.target_price`가 설정된 상품이 목표가 이하로 내려가면 `TARGET_REACHED` 기록
- 익스텐션은 `since` 파라미터로 증분 폴링 → 알림 중복 방지

### 2.4 올리브영 크롤러 (server/crawlers/, Playwright 전환)

- 기존: HTTP GET + requests → TLS 핑거프린팅 403 (실측)
- 신규: `sync_playwright` + `channel="chrome"` (시스템 Chrome) headless
  - 상품 상세 페이지 `goodsNo` 기준 진입 → `body`에서 가격 추출 + `og:title`/`og:image`
  - 실측 PoC: 39,900원 + og 메타 수집 성공
- 워커: `worker.py` 주기 실행 (기본 1일 1회, 상품 수에 따라 조정)

## 3. 브라우저 익스텐션 (extension/, Chrome MV3)

### 3.1 구성

```
extension/
├── manifest.json          # MV3, permissions: tabs storage alarms notifications
├── background.js          # 서비스 워커: 탭 감지 → 수집 → 폴링 → 알림
├── content.js             # DOM 가격/제목/이미지 추출 (전역 몰 판별)
├── popup/
│   ├── popup.html/.css/.js # 찜 목록 + 추이 + 최근 알림
└── options/
    └── options.html/.js   # 서버 URL, 알림 주기, 몰 활성화 (추후)
```

### 3.2 manifest 권한

```json
{
  "manifest_version": 3,
  "permissions": ["storage", "alarms", "notifications", "tabs"],
  "host_permissions": [
    "*://smartstore.naver.com/*", "*://shopping.naver.com/*", "*://brand.naver.com/*",
    "*://search.shopping.naver.com/*", "*://www.coupang.com/*",
    "*://www.oliveyoung.co.kr/*", "http://127.0.0.1:8000/*"
  ]
}
```

### 3.3 수집 파이프라인 (background.js)

```
chrome.tabs.onUpdated (status=complete) ──▶ URL → MallParser(mall+productID)
  ──▶ content script 주입(tabs.sendMessage) ──▶ DOM 추출(가격/제목/이미지)
  ──▶ 서버: POST /products (upsert) + POST /products/{id}/prices (source=extension)
  ──▶ chrome.storage에 마지막 수집 타임스탬프 (중복 억제: 동일 상품 10분 내 재수집 금지)
```

### 3.4 가격 추출 셀렉터 (content.js — 실측 기반)

| 몰 | 가격 | 제목 | 이미지 |
|----|------|------|--------|
| 네이버+ 스토어/브랜드 | `body` 내 텍스트 정규식 `[0-9,]+원` (가장 큰 값) | `meta[property=og:title]` | `meta[property=og:image]` |
| 네이버 쇼핑 카탈로그 | `body` 내 `[0-9,]+원` | og:title | og:image |
| 쿠팡 | `body` 내 `%` 인접 숫자 (쿠팡 가격은 % 오프 금액) | og:title | og:image |
| 올리브영 | `body` 내 `[0-9,]+원` | og:title | og:image |

- 1차: 구조적 셀렉터(상품명 클래스) → 2차: body 텍스트 정규식 폴백
- 쿠팡은 % 패턴(실측: 가격이 `%`와 함께 렌더링) 우선, 실패 시 og/정규식 폴백

### 3.5 알림 파이프라인

```
chrome.alarms (기본 5분) ──▶ GET /devices/{id}/alerts?since={last}
  ──▶ 신규 알림 → chrome.notifications.create (PRICE_DROP / TARGET_REACHED)
  ──▶ 알림 클릭 → 상품 페이지 탭 열기 (링크 포함)
```

### 3.6 기기ID

- 최초 실행 시 `crypto.randomUUID()` 생성 → `chrome.storage.local`
- 서버에 `POST /devices`로 등록 (이미 있으면 그대로 재사용)
- 팝업/백그라운드 모두 같은 기기ID 사용

### 3.7 UI 디자인 시스템 (v0.11.0)

> 디자인 토큰(CSS 변수)을 단일 소스로 두고, 팝업/플로팅(shadow)/옵션/온보딩이 공유한다.

**토큰 소스**
- `extension/swb-tokens.css` — 팝업/옵션/온보딩은 `<link>`로 공유
- `swb-ui.js` — shadow DOM `:host` 선택자에 동일 토큰을 JS 주입 후 `var()` 참조

**주요 토큰 (요약)**
| 그룹 | 토큰 | 값 |
|------|------|----|
| 브랜드 | `--swb-primary` / `-soft` / `-soft-2` | `#2d4ae0` / `#f2f4ff` / `#eef1ff` |
| 위험 | `--swb-danger` / `-soft` | `#e5484d` / `#fff8f6` |
| 텍스트 | `--swb-text` / `-secondary` / `-muted` / `-faint` | `#1c1c1e` / `#555` / `#8a8f98` / `#aaa` |
| 몰 | `--swb-mall-{naver,coupang,oliveyoung}` | `#03c75a` / `#0074e9` / `#56a99c` |
| 라운드 | `--swb-radius-{sm,md,lg,pill}` | `6px` / `8px` / `12px` / `999px` |
| 타이포 | `--swb-fs-{xxs,xs,sm,base,md,lg,xl}` | `10`~`20px` |
| 간격 | `--swb-space-1..6` | `4`~`24px` (4px 그리드) |
| 그림자 | `--swb-shadow-{sm,md,lg,brand}` | 4종 |

**컴포넌트 통일 규칙**
- 기간 탭(1/7/30일)·목표가 행·스피너·썸네일·배지·빈/에러/로딩 상태는 팝업과 플로팅이 동일 스타일 사용
- 버튼 계열: `.btn`(`primary`/`ghost`/`danger`) + FAB 스타일

**UX 규칙**
- FAB는 화면 오른쪽 1/4 지점 고정(`bottom: calc(25vh - 23px)`), 메뉴 원점은 FAB 중심(`bottom:25vh`)과 일치
- 메뉴 3방향: 위(핫딜/알림) · **왼쪽(가격 추이 FAB와 같은 높이, 찜 목록)** · 아래(설정/디버그, 라벨 dir=above) — 추이가 버튼 왼쪽에 가장 가깝게 노출
- **아이콘 간격 48px 통일** (위 -60/-108 · 왼쪽 0/48 · 아래 60/108) — 사용법(help) 메뉴는 온보딩에서만 안내
- 팝업 헤더는 로고+설명만, 상태(status)는 본문 최상단 별도 영역

**접근성**
- 아이콘은 SVG 사용(이모지 금지), `:focus-visible` 포커스 링, 인터랙티브 요소 `aria-label`

## 4. 플랫폼 분기

- 확장자는 Chrome MV3 단일 코드 (Edge/Whale manifest 호환)
- `// BRIDGE:` 불필요 (브라우저 네이티브 API 직접 사용)
- 서버는 Python FastAPI 단일

## 5. 에러코드 체계

- `E-SRV-{CAT}-{NNNN}`: 서버 (NET/DB/VALID/CRWL)
- `E-EXT-{CAT}-{NNNN}`: 익스텐션 (NET/URL/VALID/ALERT)
- 매핑: 루트 `error_message_ko.json` (익스텐션이 사용자 노출 시 참조)

## 6. 성능 예산

| 지표 | 목표 |
|------|------|
| 콘텐츠 스크립트 추출 | ≤ 100ms |
| 탭 이벤트 핸들러 | ≤ 50ms (DOM 접근은 content script에 위임) |
| 알림 폴링 | 5분 주기, 서버 부하 1 device 기준 무시 가능 |
| 서버 크롤러 | 1일 1회 (올리브영) |
