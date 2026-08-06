# 세션 로그 — 2026-08-06 (T-96a 웨일 심사 스크린샷 자동 캡처)

## 1. 무엇을 (T-96a)
- 웨일 스토어 심사용 스크린샷을 사용자가 직접 찍을 수 있도록 **자동 캡처 스크립트 + 가이드 문서** 제작
- `scripts/store-capture/capture.js`: 웨일 실행 → 확장 unpacked 로드 → 서버에 데모 데이터 주입 → 팝업 캡처 2장 → 자동 정리
- `scripts/store-capture/cleanup.js`: 데모 수동 정리 (capture 비정상 종료 대비)
- 서버 `DELETE /products/{id}` API 추가 (데모 정리용, FK 참조 테이블 정리 후 삭제)
- `docs/store/SCREENSHOT_GUIDE.md`: 자동(방법 A)/수동(방법 B) 캡처 가이드 + 스토어 제출 체크리스트

## 2. 플랫폼
- server + store (웨일 스토어 심사)

## 3. 빌드/배포 결과
- pytest **34건 전체 통과** (test_demo_cleanup.py 2건 추가)
- Render 배포 완료: `DELETE /products/{id}` → 실서버 204 확인 (started_at 06:01)
- capture.js 최종 검증: 팝업 상태 정상 (현재 상품 8,900원 + 평균 9,400원/최저 8,900원 + 핫딜 5개) + 데모 자동 정리 완료 + 잔여 404 확인
- 커밋: `1082a1b`(스크립트+API+가이드), `a587eb3`(스크린샷+CHANGELOG) — 둘 다 push 완료
- 스크린샷: `docs/screenshots/store/shop-wisebar-{01,02}.png` (320×600, 데모 데이터 채움)

## 4. 남은 TODO (T-번호)
- **T-96a 잔여**: 사용자가 생성된 PNG 2장을 열어 품질 확인 → 스토어 요구 해상도(1280×800 등)에 맞춰 리사이즈 필요 시 `sips` 사용 (가이드에 명시)
- T-96b: zip + 리스팅 확정 (STORE_LISTING.md)
- T-96c: 웨일 개발자 등록 + 업로드 + 리뷰 요청 (사용자)
- T-96d: 심사 통과 + README 링크 반영

## 5. 다음 에이전트 전달 사항
- 캡처 실행: `cd scripts/store-capture && npm install && node capture.js [상품URL]`
- ⚠ 데모 주입은 **서버에 없는 새 상품 URL** 사용 권장 (이미 존재하면 실데이터 보호 위해 주입 생략 → 빈 화면)
- ⚠ 쿠팡 URL은 봇 차단(403) 가능 — 네이버 스마트스토어 권장
- 데모 데이터는 `demo:` 접두어 + 스크린샷용 상품은 자동 삭제됨. 잔여 시 `node cleanup.js`
- 참고: 기본 데모 가격 9900→9400→8900원 (역대 최저가 배지 + 트렌드 표시용), 핫딜 상품 5개 5~13% 하락

## 6. 문서 업데이트 목록
- `docs/store/SCREENSHOT_GUIDE.md` (신규), `docs/plans/PLAN_v0.10.5_store-whale.md` (T-96a 갱신), `docs/TODO.md` (T-96a 부분 완료), `docs/CHANGELOG.md` (v0.10.4-post T-96a), `.gitignore` (.whale-profile/tmp PNG/node_modules)

## 7. 오프라인 큐 상태
- 해당 없음 (chrome+server 단일, 오프라인 큐 미도입)

## 8. E2E/k6
- 해당 없음. 대신 capture.js 실서버 E2E 검증 완료 (주입→캡처→정리)
