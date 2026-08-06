# 세션 로그 — 2026-08-06 store(웨일 스토어 등록 준비) 마무리

## 1. 무엇을
- T-96b 웨일 스토어 패키징 + 리스팅 확정, GitHub Release v0.12.2 생성, README 갱신
- 온보딩 페이지 스크린샷 이미지 추가 + 미사용 파일 삭제

## 2. 플랫폼
- extension(Chrome MV3 / 웨일 호환) + store(웨일 스토어 등록 준비) + scripts

## 3. 빌드 결과
- `webstore-publish.sh --dry-run` ✅ → `dist/shop-wisebar-v0.12.2.zip` (336KB, 미사용 파일 제외 확인)
- GitHub Actions `Release Extension` v0.12.2 → **success** (zip 자동 첨부: shop-wisebar-v0.12.2.zip)
- `capture.js` 캡처 재실행 ✅ — 실데이터(25,400원) 보존 확인, 온보딩 이미지 5장 자동 재생성

## 4. 남은 TODO
- T-96c: 웨일 스토어 업로드 (사용자 네이버 계정 필요 — 대시보드 수동)
- T-96d: 심사 통과 확인 + README 웨일 스토어 링크 반영

## 5. 다음 에이전트 전달
- T-96c는 자동화 불가(사용자 로그인 필요). 업로드 안내는 `docs/store/STORE_LISTING.md`의 "웨일 스토어 등록 절차" 참고.
- zip: `dist/shop-wisebar-v0.12.2.zip`, 스크린샷: `docs/screenshots/store/shop-wisebar-01~05.png`
- 릴리즈: https://github.com/BoraSarang/Shop-WiseBar/releases/tag/v0.12.2

## 6. 문서 업데이트
- `docs/CHANGELOG.md` v0.12.2(T-96b) 항목 확장, `docs/TODO.md` T-96b 완료 표시, `README.md` 갱신

## 7. 오프라인 큐 상태
- 해당 없음 (확장 내 오프라인 큐 미적용 단계)

## 8. E2E/k6 결과
- 해당 없음 (이번 세션은 스토어 패키징/문서 작업)
