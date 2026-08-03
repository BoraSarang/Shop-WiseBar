# 세션 로그 — 2026-08-03 [macos]

## 무엇을
T-57 메뉴바 팝오버 2모드 재설계: 캐치 모드(CapturedProductView — 상품 정보 + 기간 탭[7일/1개월/전체] 가격 추이 + 최저/최고/평균 + 현재 최저가 판정 + 절약액 + 추적 시작/찜됨) / 홈 모드(마지막에 본 상품 + 찜 목록 진입) / 찜 목록 모드(기존 관리 화면 + 뒤로).

## 어떤 플랫폼
[macos] 클라이언트 + [server] API 재사용(가격 이력 GET /prices는 기존)

## 빌드 결과
`./build_and_run.sh debug macos` 성공 (xcodegen generate 포함, CapturedProductView.swift 추가됨). 기존 NSLock 경고만 잔존(기존 코드).

## 검증 (실기기)
- 홈 모드: 마지막 본 상품 안내 + 찜 목록 진입 버튼 — PASS
- 캐치 모드: 비관심 상품 (teststore:999999 is_watched=false) — 상품 정보 + 추이 표시 — PASS
- 캐치 콘텐츠 상단 정렬 요청 반영 — PASS
- 관심 상품 등록(PUT /watches 200) 후 자동 팝오버 + 캐치 뷰(찜됨) — PASS
- 스크린샷: docs/screenshots/macos/v0_3_t57_capture.png (캐치), v0_3_t57_home.png (홈)

## 남은 TODO
- T-56 배포 준비 (Docker/호스팅) — 다음 우선순위
- T-58 서버 추천 리스트 (베스트/최신 할인) — 데이터 축적 후
- 알림 수신 확인 (알림 권한 승인 후)

## 다음 에이전트 전달
- T-57 관련 에러코드 신규 없음 (E-MAC-NET-2001~2003 기존 사용)
- `defaults write com.borasarang.ShopWiseBar AutoOpenPopover -bool YES` 상태로 남아있음 — 검증 완료 후 삭제 권장
- 서버: `server/.venv/bin/uvicorn app.main:app --port 8000` 실행 중 (테스트 상품 store:teststore:999999 watch 등록됨)
- BrowserMonitor는 URL 변경 시마다 서버 getProduct+getPriceHistory 2회 호출 — 상품 페이지 내 옵션 변경 시 중복 감지 가능, 추후 디바운스 검토
