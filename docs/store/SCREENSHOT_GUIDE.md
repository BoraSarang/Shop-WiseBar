# 웨일 스토어 심사용 스크린샷 캡처 가이드 (T-96a)

> 목적: 웨일 스토어 리스팅에 올릴 스크린샷 2장을 준비한다.
> 대상 파일: `docs/screenshots/store/shop-wisebar-01.png` (현재 상품 탭) · `shop-wisebar-02.png` (핫딜 탭)
> 두 방법이 있다. **방법 A(자동 스크립트)** 를 먼저 권장한다.

---

## 방법 A. 자동 캡처 스크립트 (권장)

웨일 브라우저 + `playwright-core`로 확장을 로드해, 서버에 데모 데이터를 넣고 팝업을 캡처한다.
데모 데이터는 캡처가 끝나면 자동으로 삭제된다.

### 1. 사전 준비

| 항목 | 확인 |
|------|------|
| 웨일(Whale) 설치 | `/Applications/Whale.app` (macOS) |
| 서버 동작 | `https://shop-wisebar.onrender.com` 응답 확인 (`curl https://shop-wisebar.onrender.com/health`) |
| Node.js 18+ | 터미널에서 `node -v` |

### 2. 의존성 설치 (최초 1회)

```bash
cd scripts/store-capture
npm install
```

### 3. 캡처 실행

```bash
node capture.js
```

- 기본 상품 URL: 네이버+ 스토어 상품 예시
- 다른 상품으로 캡처하려면 URL을 인자로 전달:

```bash
node capture.js "https://shopping.naver.com/{스토어}/products/{상품번호}"
node capture.js "https://www.coupang.com/vp/products/{상품번호}"
```

> ⚠ 쿠팡 상품 URL은 봇 차단(403)으로 열리지 않을 수 있다. 네이버+ 스토어 권장.
> ⚠ URL의 상품이 서버에 **이미 존재하면 실데이터 보호를 위해 데모 주입을 생략**한다.
>    이 경우 현재 상품 탭이 빈 상태로 캡처될 수 있다 — 스크린샷용으로는 서버에 없는 새 상품 URL을 쓰는 게 좋다.

### 4. 동작 과정

1. 서버에 데모 상품 5개 + 가격 이력(하락) 주입 → 핫딜 탭 채움
   - v0.10.7 (T-96a): 하락 시점을 `captured_at`으로 과거에 지정 — 7일 하락 3개 / 30일 하락 2개로
     기간별 탭 목록을 구분 (7일 탭 3개, 30일 탭 5개)
2. 현재 상품 URL이 서버에 없으면 가격 이력 3개 주입 → 현재 상품 탭 채움
3. 웨일 실행 + 확장 로드(unpacked) → 상품 페이지 탭 열기
4. 스크린샷 3장 캡처:
   - ① 상품 페이지 전체 1280×800 — **플로팅 버튼이 보이는 실사용 화면**
   - ② 팝업 320×600 — 현재 상품 탭 (핫딜 7일 기본 노출)
   - ③ 팝업 320×600 — 핫딜 "30일" 탭 (7일과 목록 구분)
5. **데모 데이터 자동 삭제** (추가한 상품 전부 DELETE)

### 5. 결과 확인

```bash
ls -la docs/screenshots/store/*.png
```

- `shop-wisebar-01.png` — **1280×800 (상품 페이지 + 플로팅 버튼)** — 심사용 메인 화면
- `shop-wisebar-02.png` — 320×600 (팝업 현재 상품 탭)
- `shop-wisebar-03.png` — 320×600 (팝업 핫딜 30일 탭)
- 팝업 화면 상태(상품명·가격·핫딜 목록)는 실행 로그의 `▸ 팝업 상태:` JSON에서 확인 가능
- 플로팅 버튼은 실행 로그의 `✓ 플로팅 버튼 표시 확인` 메시지로 확인 가능

### 6. 실패 시

- **서버가 콜드스타트 중**: 로그에 "데모 데이터 주입 실패" — 잠시 후 재실행
- **데모 정리 실패(405)**: 서버에 `DELETE /products/{id}` 가 배포되지 않은 것. 서버 push/배포 후 아래 수동 정리:
  ```bash
  cd scripts/store-capture
  node cleanup.js
  ```
- **확장 ID 못 찾음**: 웨일 창에서 `chrome://extensions` → 개발자 모드 → 똑바 확장 ID 확인

---

## 방법 B. 수동 캡처 (스크립트 없이)

확장을 직접 로드해 원하는 상품 페이지에서 캡처하는 방법. 스토어 스크린샷은 보통 1280×800 이상을 권장하므로, 이 방법은 "실사용 화면"을 원할 때 쓴다.

### 1. 확장 로드

1. 웨일 주소창 → `chrome://extensions`
2. 우측 상단 **개발자 모드** 켜기
3. **압축해제된 확장 프로그램 로드** → `extension/` 폴더 선택
4. 확장 아이콘이 툴바에 표시되는지 확인

### 2. 상품 페이지에서 팝업 캡처

1. 네이버+ 스토어/쿠팡 상품 페이지를 연다 (가격 이력이 쌓인 상품 권장)
2. 툴바의 똑바 아이콘 클릭 → 팝업 열기
3. **화면 1 (현재 상품 탭)**: 상품명·가격·최저가 요약이 보이도록 캡처
4. **화면 2 (핫딜 탭)**: 핫딜 목록이 보이도록 "7일" 탭 클릭 후 캡처
5. 저장: `docs/screenshots/store/shop-wisebar-01.png` / `-02.png`

macOS 캡처 단축키: `Shift + Command + 4` (영역 선택)

> 💡 가격 이력이 없으면 "기록 N개 · 데이터 쌓이는 중" 배지만 보인다.
> 실제 하락 이력을 원하면, 데모 데이터를 서버에 넣고 싶다면 방법 A 사용.

---

## 스토어 제출 전 확인

- [ ] `shop-wisebar-01.png` — **1280×800**, 상품 페이지 + 플로팅 버튼(파란 원형)이 보이는지
- [ ] `shop-wisebar-02.png` — 320×600, 상품명·가격·최저가 요약이 보이는지
- [ ] `shop-wisebar-03.png` — 320×600, 핫딜 상품 3개 이상 + 하락% 배지가 보이는지 (30일 탭)
- [ ] 웨일 스토어 요구 해상도 확인 (필요 시 `sips`로 리사이즈):
  ```bash
  sips -z 800 1280 docs/screenshots/store/shop-wisebar-01.png --out docs/screenshots/store/shop-wisebar-01-1280.png
  ```
- [ ] 리스팅 입력값: `docs/store/STORE_LISTING.md`

## 관련 파일

| 파일 | 역할 |
|------|------|
| `scripts/store-capture/capture.js` | 자동 캡처 스크립트 (데모 주입 + 캡처 + 자동 정리) |
| `scripts/store-capture/cleanup.js` | 데모 데이터 수동 정리 |
| `scripts/store-capture/package.json` | playwright-core 의존성 |
| `server/app/routers/products.py` | `DELETE /products/{id}` (T-96a, 데모 정리용) |
| `server/tests/test_demo_cleanup.py` | 상품 삭제 API 테스트 |
