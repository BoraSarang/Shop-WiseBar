# 스토어 배포 실행 안내 (Chrome + 웨일)

> 목적: "작업하자" 했을 때 이 문서만 보고 순서대로 배포를 진행할 수 있도록 절차·체크리스트·필수 준비물을 정리.
> 상태: Chrome Web Store 리스팅 준비 완료(v0.10.2), 실제 등록/제출은 미진행. 웨일 스토어는 사전 조사 완료.
> 마지막 갱신: 2026-08-05

## 0. 배포 전 필수 확인 (두 스토어 공통)

- [x] 확장이 `dist/shop-wisebar-v{VERSION}.zip`으로 패키징 가능 — `./scripts/webstore-publish.sh --dry-run`
  - JS 문법 + manifest 검증 자동 수행, 매번 실수 방지
- [x] manifest 권한 최소화 — `tabs` 제거 → `activeTab` (v0.10.2)
- [x] 개인정보 처리방침 — https://borasarang.github.io/Shop-WiseBar/privacy.html (스토어 입력용 URL)
- [ ] **스크린샷 캡처 (1280×800, 2장 이상)** — 아직. 아래 "스크린샷 캡처" 참고
- [ ] 최신 테스트: `server/tests` pytest 전체 통과 + 확장 실기기(Chrome/Edge/Whale) 동작 확인

### 스크린샷 캡처 (배포 직전 준비 — 자동 생성 불가, 실제 화면 필수)

> 스토어는 "실제 실행 화면"을 요구한다. 합성 이미지는 심사 부적합.

```bash
# 1) Chrome/Whale/Edge에서 개발자 모드 → 압축해제된 확장 로드
#    경로: /Users/lee/Documents/Apps/Shop WiseBar/extension
# 2) 쇼핑몰 상품 페이지 방문 (가격 이력이 소진 상태로 — 팝업이 빈 화면이면 안 됨)
# 3) 팝업 열고 → 트렌드 그래프 + 최저가 요약 화면 (화면 1)
# 4) 핫딜 탭 열기 → 상품 배지 화면 (화면 2)
# 5) 1280×800 창으로 조절 후 캡처 (macOS: Cmd+Shift+4, 또는 브라우저 DevTools 원격 디바이스 탭)
# 6) 저장: docs/screenshots/store/
```

---

## A. Chrome Web Store (지상, 유료 $5 일회성)

### A1. 준비물
- **zip**: `dist/shop-wisebar-v{VERSION}.zip` — `./scripts/webstore-publish.sh --no-run` 으로 생성
- **스크린샷**: 최소 2장 이상 (1280×800 PNG/JPEG)
- **아이콘**: 128×128 PNG (이미 있음— `extension/icons/icon128.png`)
- **개인정보 처리방침 URL**: https://borasarang.github.io/Shop-WiseBar/privacy.html
- **리스팅 작성자료**: `docs/store/STORE_LISTING.md` (설명·카테고리·키워드·권한 설명 문구)

### A2. 등록 순서
1. **개발자 등록**: https://chrome.google.com/webstore/devconsole/ → Chrome 로그인 → 개발자 대시보드 시작
   - 결제: 일회성 등록 수수료 **$5** (카드)
2. **새 항목 업로드**: 대시보드 → 새 항목 → `zip` 파일 업로드
   - 스토어가 zip을 풀어 manifest/아이콘/권한 자동 확인 → **유효성 검사 통과 확인**
3. **스토어 등록정보 입력** (`docs/store/STORE_LISTING.md`에 작성된 내용 그대로):
   - 이름 / 상세/간단 설명 / 카테고리(생산성) / 언어(한국어)
   - 스크린샷 업로드 (★필수, 최소 2장)
   - 프로모션 타일 (선택)
   - 아이콘 (128×128)
4. **개인정보 보호**: 개인정보 처리방침 URL 입력 + "판매성 없음" 확인
   - 접근 허용/권한별 용도 설명 입력 (STORE_LISTING.md "접근 허용 심사 설명" 표)
5. **가격/배포 국가**: 무료 + 전체 국가
6. **심사 제출**: 저장 → "검토하기 위해 제출"

### A3. 심사 기대
- 검수 소요: 보통 1일~수 일 (발행 승인 시 스토어 페이지 자동 생성)
- 주의: 업로드하는 파일은 `.zip` 형식 (스토어가 자동 해제·검사)
- 새 버전 배포 시 **manifest 버전을 올린 새 zip** 재업로드 (배포판과 manifest 버전 일치 필수 — `release.yml`이 강제)

---

## B. 웨일 스토어 (store.whale.naver.com — 네이버, 무료)

### B1. 준비 (Chrome과 동일 파일 재사용)
- **zip**: `dist/shop-wisebar-v{VERSION}.zip` 그대로 사용 (MV3 호환)
- **스크린샷 1~4장**: Chrome과 동일 파일 재사용 가능
- **아이콘**: 동일 (`icons/icon128.png`)
- 네이버 아이디 필수

### B2. 등록 순서 (웨일 개발자센터: https://developers.whale.naver.com/distribution/)
1. **개발자 등록** (최초 1회): 웨일 스토어 접속 → 네이버 로그인 → 계정 정보 > 개발자 → 개발자 등록. **무료** (신용카드 불필요)
2. **새 확장앱 추가**: 새 확장앱 추가 → zip 파일 선택
3. **확장앱 정보 입력**:
   - 언어 / 앱 아이콘 / **스크린샷 이미지(1~4장)** / 상세 설명 / 분류 / 공개 설정
   - Chrome Web Store와 마찬가지 zip + 리스팅 입력 (+ 개인정보 처리방침)
4. **리뷰 요청**: 저장 → 리뷰 요청 클릭
5. **심사 통과**: 웨일 스토어에 공개 (검수 보통 1~수 영업일)

### B3. Chrome 차이점/주의
- 웨일은 **무료** (등록 수수료 없음)
- MV3 Chrome 확장과 호환 — 별도 코드 변경 없음 (Chrome 배포판 그대로 재사용)
- 리스팅 설명은 Chrome 자료 재사용 (`STORE_LISTING.md`)

---

## 배포 후 후속(양 스토어 공통)
- [ ] 새 버전 릴리스 → `release.yml` (tag push → zip + GitHub Release) → 재업로드 절차 동일
- [ ] 심사 거부/보류 시 : 거부 사유 정리 → 수정 → 재제출
- [ ] 사용자 가이드 링크(README): 스토어 페이지 URL 반영

---

## 배포 순서 판단 (권장 — 2026-08-06 갱신)
1. **웨일 스토어** — 무료, 네이버 사용자 대상, MV3 재사용 → **먼저 진행 (T-96)**
2. **Chrome Web Store** — 주 타깃이지만 일회성 등록 수수료 **$5** 필요 → 웨일 완료 후 최하위 우선순위로 진행 (T-97 보류)

> 현재 위치: **웨일 스토어 등록 진행 중 (T-96)**. 남은 것은 스크린샷 2장 + 계정 등록 + 업로드/심사. Chrome은 T-97 보류.