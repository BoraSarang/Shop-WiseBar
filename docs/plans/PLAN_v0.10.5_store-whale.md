# PLAN v0.10.5_store-whale — 웨일 스토어 실등록 (T-96)

> 상태: 진행 중 (2026-08-06). 웨일(store.whale.naver.com)은 **무료**라 우선 진행.
> Chrome Web Store($5)는 T-97로 분리, 최하위 우선순위로 보류.
> 세션 단절 대비: 이 문서가 먼저, 등록 절차는 docs/store/DEPLOYMENT.md 참조.

## 1. 개요
- 목표: v0.10.2 기준 zip을 웨일 스토어에 업로드 → 심사 통과 → 공개
- 이유: 무료 + 네이버 사용자 타깃 + MV3 Chrome 배포판 재사용 (별도 코드 변경 없음)

## 2. 결정 사항
- **T-96(웨일)은 진행 / T-97(Chrome $5)은 보류 최하위** — 사용자 결정 (2026-08-06)
- zip: `dist/shop-wisebar-v0.10.2.zip` (webstore-publish.sh 검증 완료, 76KB)
- 리스팅: `docs/store/STORE_LISTING.md` 재사용 (웨일도 동일 입력 필드)

## 3. 구현 단계 (사용자 브라우저/계정 참여 필요)

### T-96a 스크린샷 준비
- [ ] 확장 로드: Chrome/Whale → `chrome://extensions` → 개발자 모드 → `압축해제된 확장 로드` → `extension/` 폴더
- [ ] 네이버/쿠팡 상품 페이지 방문 → 가격 이력이 쌓인 상태로 팝업 열기
- [ ] ① 트렌드 그래프 + 최저가 요약 ② 핫딜 탭 — 1280×800 창으로 2장 캡처
- [ ] 저장: `docs/screenshots/store/shop-wisebar-{01,02}.png`

### T-96b zip + 리스팅 확정
- [x] `./scripts/webstore-publish.sh --dry-run` — zip 생성 + manifest 검증 통과 (v0.10.2, 76KB)
- [ ] `STORE_LISTING.md` 값 확인 (웨일 입력용 — 이름/설명/권한 설명 동일 재사용)

### T-96c 업로드 + 리뷰 요청 (사용자)
- [ ] https://developers.whale.naver.com/distribution/ → 네이버 로그인 → 개발자 등록 (무료)
- [ ] 새 확장앱 추가 → zip 업로드 → 리스팅 입력(스크린샷/설명/분류) → 리뷰 요청

### T-96d 심사 통과 후
- [ ] 웨일 스토어 페이지 URL 확인
- [ ] README + DEPLOYMENT.md에 웨일 링크 반영
- [ ] CHANGELOG 기록

## 4. 테스트/검증
- [ ] webstore-publish.sh --dry-run 통과 (패키징)
- [ ] 웨일 심사 통과 확인

## 5. 롤백 계획
- 심사 거부 시: 거부 사유 정리 → 수정 → 재제출 (DEPLOYMENT.md 참조)
- 업로드 실패: zip 재패키징 후 재업로드

## 6. 에러코드
- 신규 불필요 (심사 절차 — 코드 변경 없음)

## 7. DoD
- [ ] 웨일 스토어 공개 + 링크 반영
- [ ] TODO T-96 완료 처리
