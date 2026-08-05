# PLAN v0.10.2_store — Chrome Web Store 배포 준비 (T-90)

> 상태: 진행 중 (2026-08-05). 다음 단계: 스토어 배포 ① → 서버 운영 ② (나중)
> 세션 단절 대비: 이 문서가 먼저, 코드는 그 다음.

## 1. 개요

확장(0.10.1)이 Chrome/Edge/Whale 실기기 검증 완료되고 서버 테스트도 통과했다.
이제 Chrome Web Store에 공개 배포하기 위한 **리스팅 준비물 + 심사 대응 체크리스트**를 완성한다.

## 2. 현재 상태 (2026-08-05 확인)

| 항목 | 상태 |
|------|------|
| 아이콘 | ✅ 16/48/128 PNG 존재 (`extension/icons/`) |
| CSP | ✅ 기본값(`script-src 'self'`), `unsafe-eval` 없음 — manifest에 명시 없음 |
| web_accessible_resources | ✅ 없음 (간결) |
| permission | storage, alarms, notifications, tabs, webNavigation — 최소인지 재검토 필요 |
| host_permissions | 쇼핑몰 5 + localhost:8000 + onrender API — 범위 명시 |
| 옵션 페이지 | ✅ open_in_tab |
| privacy_policy | ❌ 미준비 (device_id 수집 → 사용자 데이터 취급 정책 문서 필요) |
| 스토어 설명/스크린샷 | ❌ 미준비 |
| 배포 스크립트 | ❌ `scripts/webstore-publish.sh` 없음 |

## 3. 결정 사항

- **배포 플랫폼**: Chrome Web Store 단일 (Edge/Whale은 Chrome 스토어 호환)
- **privacy_policy**: GitHub Pages 랜딩(`https://borasarang.github.io/Shop-WiseBar/`)에 정책 페이지 추가, manifest `privacy_policy` 지정
- **permission 재검토**: `tabs`/`webNavigation` 필요성 대조 → 불필요 시 제거(최소 권한)
- **스토어 리스팅**: 설명·카테고리·키워드 작성 + 스크린샷 생성(스토어 요구 1280×800)
- **배포**: 계정/개발자 등록(결제)은 사용자가 진행, 스크립트·체크리스트·패키징(zip)을 에이전트가 준비

## 4. 구현 단계

- [ ] T-90a: permission 최소 권한 재검토 + manifest 갱신 (tabs/webNavigation 대조)
- [ ] T-90b: `docs/chrome/PERMISSIONS.md` 최신 manifest 대조 갱신
- [ ] T-90c: privacy_policy 작성 (데이터 취급: device_id/가격 정보/보존·삭제) + 랜딩에 게시
- [ ] T-90d: 스토어 리스팅 자료 — 설명(short/long) · 카테고리 · 키워드 + 스크린샷(1280×800) 1~2장
- [ ] T-90e: `scripts/webstore-publish.sh` + 패키징 zip 생성 스크립트 (dry-run 지원)
- [ ] T-90f: 심사 체크리스트 대조 + 검증 + CHANGELOG + 커밋
- [ ] T-90g: GitHub Actions 릴리즈 워크플로우 — 태그 push 시 zip 패키징 + GitHub Release + zip 업로드 (사용자 요청)

## 5. 테스트 계획

| TC | 대상 | 검증 |
|----|------|------|
| TC-90-1 | manifest | `node --check` 통과 + permission 최소 권한 + CSP 무해 |
| TC-90-2 | 패키징 zip | 압축 해제 → manifest 존재 + JS 문법 통과 |
| TC-90-3 | privacy 링크 | 랜딩 URL 200 + manifest 지정 |

## 6. 롤백 계획

- permission 제거는 `git revert`로 복원, Chrome 재로드로 즉시 반영
- zip은 재생성, 스토어 업로드는 게시 전 삭제 가능

## 7. 성능 영향

- permission 축소 시 확장 시작 비용 경미 감소 (tabs/webNavigation 이벤트 수신 감소)

## 8. 에러코드

- 신규 불필요 (배포 준비 문서/패키징)

## 9. DoD

- [ ] permission 최소화 대조 완료
- [ ] privacy_policy 랜딩 게시 + manifest 지정
- [ ] 스토어 설명/스크린샷 준비
- [ ] webstore-publish.sh --dry-run 통과
- [ ] CHANGELOG/TODO 반영
