# 세션 로그 — 2026-08-06 store-screenshots (T-96a v0.10.7)

## 1. 무엇을 (T-96a)
- 웨일 심사용 스크린샷 재구성: 팝업만 있던 2장(사실상 동일 화면) → 3장 구성
  - 01: 상품 페이지 1280×800 + 플로팅 버튼 (실사용 화면)
  - 02: 팝업 320×600 (7일 탭 — 데모 3개 + 스크린샷용 상품 = 4개)
  - 03: 팝업 320×600 (30일 탭 — 데모 5개)
- 원인: 7일 버튼이 기본 active라 02/03이 diff 0. 서버 데모 하락 시점을 captured_at으로 과거 지정해 기간별 구분.

## 2. 플랫폼
- chrome(웨일) + server. capture.js / server schemas.py·products.py / docs

## 3. 변경 내용 (커밋 3건)
- db5bf47 `feat(store)`: captured_at + 데모 기간 구분 + PLAN/GUIDE/CHANGELOG
- f825745 `chore(server)`: APP_VERSION 0.10.7
- 1cf25af `fix(store)`: shadow DOM 플로팅 감지 + 로딩 폴링
- 모두 main push → Render 자동 배포 완료 (v0.10.7 확인)

## 4. 검증 결과
- pytest 36건 통과 (captured_at 테스트 2건 추가)
- 캡처 로그: 플로팅 표시 확인 ✓ / 02 상태 "불러오는 중" 해결 ✓
- 픽셀: 01 FAB 원형 1512px (x1214-1259,y577-622) / 01vs02 diff 71,947 / 02vs03 diff 17,549

## 5. 남은 TODO
- T-96a: 사용자 육안 확인 (open 3장) → [x] 마무리
- T-96b: zip 패키징 + 리스팅 자료 확정
- T-96c/d: 웨일 등록·업로드·심사

## 6. 전달 사항
- 네이버 스마트스토어 429 봇 차단 가능 — 01 상품 페이지가 빈 화면으로 캡처될 수 있음(이번엔 FAB 확인됨).
- 데모 하락은 captured_at(priceDays/dropDays)으로 시점 지정 — 기간별 탭 구분 필수.

## 7. 오프라인 큐
- 해당 없음 (E2E/오프라인 기능 아님)

## 8. E2E
- 해당 없음 (E2E 회귀는 미실행 — server 변경은 captured_at 옵션 추가뿐이라 영향 없음)
