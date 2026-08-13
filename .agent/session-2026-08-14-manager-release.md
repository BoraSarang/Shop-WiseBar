# 세션 로그 — 2026-08-14 (macos + store + release) — T-126i 마감 + 배포/릴리즈

## 1. 무엇을 (T-번호)
T-126i 마감 + v0.16.15 운영 배포 확인 + 웨일 스토어 버전 문서 동기화 + GitHub Release v0.16.11 + macOS 매니저 GitHub 링크 추가.

## 2. 플랫폼
server(배포 확인) + macos(GitHub 링크) + store(웨일 v0.16.11 문서 반영) + release(v0.16.11).

## 3. 빌드 결과
- v0.16.15 운영 배포 확인: `https://shop-wisebar.onrender.com/health` → `0.16.15 / ok / db=true`.
- 신규 엔드포인트 6종 실데이터 검증 완료: `/admin/health`, `/admin/crawler/summary`, `/admin/products/top`, `/admin/users`, `/admin/price-compare`.
- macOS: GitHub Pages + GitHub 저장소 링크 추가 후 xcodegen + xcodebuild BUILD SUCCEEDED.
- GitHub Release v0.16.11: `gh release view` 확인 — `shop-wisebar-v0.16.11.zip` 첨부, publish 완료. (v0.12.2 → v0.14.0 → v0.16.11)
- 웨일 스토어 게재: 사용자 확인으로 **v0.16.11** (문서는 v0.12.2로 낡아있어 README/CHANGELOG 동기화).

## 4. 남은 TODO
- (없음) T-126 전부 완료.

## 5. 다음 에이전트 전달 (에러코드 포함)
- 에러코드 신규 없음.
- 운영 인사이트(차기 후보): **`/admin/price-compare` 그룹 0건** — 정규화명(정확 일치) 기반이라 몰별 상품명이 달라 매칭 안 됨. 유사도 기반 매칭(토큰 교집합 등) 확장 후보.
- 운영: 크롤러 배치 정지 상태(`crawler_config.enabled=false`), 스테일 상품 2069개 확인.

## 6. 문서 업데이트
README(웨일 v0.16.11) / CHANGELOG(v0.16.15 섹션 + 웨일 v0.16.11 게재 기록) / TODO(T-126i 완료) / session 본 로그.

## 7. 오프라인 큐 상태
변경 없음.

## 8. E2E/k6
해당 없음 (매니저 GUI + 배포 확인은 실데이터 curl 검증으로 대체).