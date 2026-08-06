# PLAN v0.11.0 — UI 디자인 시스템 구축 + UI/UX 개선 (extension)

> 버전: v0.11.0 / 플랫폼: chrome(확장) / 상태: 🔵 진행 / 작성: 2026-08-06
> 관련: docs/TODO.md T-99, docs/DESIGN.md UI 디자인 시스템 섹션, docs/CHANGELOG.md v0.11.0

## 1. 개요

팝업·플로팅(swb-ui)·옵션·온보딩 4개 UI가 각자 하드코딩된 색상/간격/라운드/폰트를 사용해 시각적 불일치가 심함.
디자인 토큰(CSS 변수)을 단일 소스로 도입하고, 중복 컴포넌트 스타일을 통일하며, 온보딩 설명과 실제 FAB 배치의
불일치(FAB가 화면 1/4 지점, 문서는 "우하단")를 해소한다. 서버/API/권한은 변경하지 않는다.

## 2. 결정 사항

1. **적용 범위**: 팝업 · FAB 플로팅(swb-ui) · 옵션 · 온보딩 전체 일괄 적용
2. **토큰 전달 방식**:
   - 팝업/옵션/온보딩 → `extension/swb-tokens.css` 파일을 `<link>`로 공유
   - swb-ui.js(shadow DOM) → shadow `:host` 선택자에 토큰 CSS 변수를 주입(JS 상수) 후 `var()` 참조
3. **UX 구조 변경**: FAB는 **25vh(화면 오른쪽 1/4 지점) 유지** + 메뉴 3방향(위/왼쪽/아래) 재배치.
   가격 추이는 FAB 바로 왼쪽(같은 높이)에 배치해 클릭 즉시 가장 가깝게 노출. 설정/사용법은 아래 그룹.
   (T-99j 후속 — T-99e에서 우하단 `bottom:24px` 시도 시 메뉴 원점 23px 어긋남 + `y>0` 아이템 화면 밖 문제로 25vh 복원)
4. **컴포넌트 통일**: 기간 탭(1/7/30일) · 목표가 행 · 스피너 · 썸네일 · 배지 · 빈/에러/로딩 상태를 공통 스타일로 단일화
5. **접근성**: 이모지 아이콘(🛍️🛠🔥🎉) → SVG 교체, `:focus-visible`, `aria-label` 추가
6. **CSS 잔재 제거**: 팝업 `.alerts`·`.alert-list`·`.detail*`·`.btn-ghost`(미사용) 정리

## 3. 아키텍처

```
extension/
├── swb-tokens.css        # 신규 — 디자인 토큰 (색상/타이포/간격/라운드/그림자)
├── popup/popup.css       # 토큰 var() 참조 + 잔재 제거 + 헤더/빈상태 개선
├── swb-ui.js             # shadow CSS 상단 :host 토큰 주입 + var() 참조 + FAB/메뉴 배치 변경
├── options.html          # 인라인 <style> → swb-tokens.css link 전환
└── onboarding.html       # 인라인 <style> → swb-tokens.css link 전환 + 문구 동기화
```

### 디자인 토큰 정의 (swb-tokens.css)

| 그룹 | 토큰 | 값 | 용도 |
|------|------|----|------|
| 색상 | `--swb-primary` | `#2d4ae0` | 브랜드/활성/가격 강조 (기존 유지) |
| | `--swb-primary-strong` | `#3a5aef` | hover |
| | `--swb-primary-soft` | `#f2f4ff` | 연한 파랑 배경 통일 |
| | `--swb-primary-soft-2` | `#eef1ff` | 힌트/칩 배경 |
| | `--swb-danger` | `#e5484d` | 하락/찜해제/핫딜% (기존 유지) |
| | `--swb-danger-soft` | `#fff8f6` | 품절/알림 배경 |
| | `--swb-text` | `#1c1c1e` | 기본 텍스트 |
| | `--swb-text-secondary` | `#555` | 보조 텍스트 |
| | `--swb-text-muted` | `#8a8f98` | 약한 텍스트/배지 warn |
| | `--swb-text-faint` | `#aaa` | 빈 상태/푸터 |
| | `--swb-border` | `#eee` | 구분선 |
| | `--swb-border-strong` | `#dde1e6` | 입력 테두리 |
| | `--swb-surface` | `#ffffff` | 카드 |
| | `--swb-surface-soft` | `#f7f8fa` | 목표가 행 등 |
| | `--swb-bg` | `#f5f6fa` | 페이지 배경(옵션/온보딩) |
| | `--swb-mall-naver/coupang/oliveyoung` | `#03c75a`/`#0074e9`/`#56a99c` | 몰 브랜드 |
| 타이포 | `--swb-font` | `-apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif` | 전체 폰트 |
| | `--swb-fs-xxs/xs/sm/base/md/lg/xl` | `10/11/12/13/15/17/20px` | 크기 스케일 |
| 간격 | `--swb-space-1..6` | `4/8/12/16/20/24px` | 4px 그리드 |
| 라운드 | `--swb-radius-sm/md/lg/pill` | `6/8/12/999px` | 모서리 |
| 그림자 | `--swb-shadow-sm/md/lg/brand` | 4종 | 카드/패널/FAB |

## 4. 구현 단계 (T-번호)

- [x] **T-99a** `extension/swb-tokens.css` 신규 생성 + `manifest.json`은 CSP에 영향 없음(CSS link는 'self' 허용)
- [x] **T-99b** 팝업: `popup.css` 토큰 적용 + `.alerts/.detail*/.btn-ghost` 잔재 제거 + 헤더 status 별도 영역 + 🛠→SVG
- [x] **T-99c** 플로팅: `swb-ui.js` shadow CSS에 `:host` 토큰 주입 + `var()` 참조 + 컴포넌트 통일(기간 탭·목표가·스피너·배지·썸네일)
- [x] **T-99d** 옵션/온보딩: 인라인 `<style>` → `swb-tokens.css` link 전환
- [x] **T-99e** UX: FAB 25vh 유지 + 메뉴 3방향 재배치(가격 추이 FAB 왼쪽), 팝업 빈 상태 문구 개선 — T-99j에서 우하단 시도 정정
- [x] **T-99f** 온보딩 문구 동기화: "우하단"·메뉴 6개·툴바 설명 실제와 일치
- [x] **T-99g** 접근성: 이모지→SVG(`🛍️🛠🔥🎉`), `:focus-visible`, `aria-label`
- [x] **T-99h** 검증: `node --check` + `run-e2e.sh` 10/10 + `docs/CHANGELOG.md` + manifest v0.11.0
- [x] **T-99j** FAB 배치 후속 수정: 25vh 복원(메뉴 원점=FAB 중심 일치) + 가격 추이 FAB 바로 왼쪽 배치 + 온보딩 문구 정정 + capture 메뉴 좌표 덤프

## 5. 테스트 계획 (TC-번호)

| TC | 내용 | 방법 |
|----|------|------|
| TC-UI-001 | 팝업 정상 렌더(상품/핫딜/연관) | E2E 10/10 + a11y 덤프 |
| TC-UI-002 | FAB 우하단 위치·2방향 메뉴 펼침 | a11y 덤프 위치값 확인 |
| TC-UI-003 | 기간 탭 1/7/30일 전환 동작 | popup + swb 동일 스타일 확인 |
| TC-UI-004 | 목표가 저장/해제 동작 불변 | 기존 목표가 흐름 회귀 |
| TC-UI-005 | CSS 토큰 미적용 화면 없음 | 스타일 dump에서 var() 사용 확인 |

## 6. 롤백 계획

- T-번호 단위 커밋 → `git revert <commit>`로 개별 롤백
- `swb-tokens.css` 제거 시 팝업/옵션/온보딩은 `popup.css`/인라인으로 원복, swb-ui는 CSS 문자열 원복
- E2E 실패 시: `scripts/e2e/run-e2e.sh` 로그 확인 → 원복 → 재검증

## 7. 성능 예산 / 영향

- CSS 변수 참조로 인한 성능 영향 없음 (파서 레벨 동일)
- FAB 배치 계산 단순화(위치 고정) — `positionPanel` 로직 불변
- 팝업 열기 ≤300ms 유지

## 8. 에러코드 / 권한 / API / 캐시

- 신규 에러코드 없음 (UI 변경만). 사용자 노출 메시지 불변
- `manifest.json` 권한/구조 불변 → PERMISSIONS.md 재검토 불필요
- 서버 API·캐시 정책 불변

## 9. 문서 업데이트

- [ ] `docs/plans/PLAN_v0.11.0_design-system.md` (본 파일)
- [ ] `docs/TODO.md` T-99 등록
- [ ] `docs/DESIGN.md` UI 디자인 시스템 섹션 추가
- [ ] `docs/CHANGELOG.md` v0.11.0
- [ ] `docs/screenshots/` a11y 덤프 기록
