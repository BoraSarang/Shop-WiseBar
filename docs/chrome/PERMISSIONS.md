# 똑바(Shop WiseBar) Chrome 확장 권한 정의서

> 버전: v0.10.2 · 플랫폼: Chrome MV3 (Edge/Whale 크로미움 호환) · 상위 규칙: AGENTS.md 21.1장

## 1. manifest 권한 (`extension/manifest.json`)

| 권한 | 사용치 | 최소 필요 여부 |
|------|--------|---------------|
| `activeTab` | 팝업/옵션에서 활성 탭 URL 접근 (`tabs.query` 후 url 읽기) — v0.10.2 `tabs`에서 축소 | 필수 |
| `storage` | 기기ID·수집 쿨다운·알림 커서·찜 캐시 (`chrome.storage.local`/`session`) | 필수 |
| `alarms` | 알림 5분 폴링 (`alert-poll`) | 필수 |
| `notifications` | 가격 하락/목표 도달/품절 브라우저 알림 | 필수 |
| `webNavigation` | SPA 내비게이션 감지 (`onHistoryStateUpdated`) | 필수 |

> **v0.10.2 변경**: 광범위한 `tabs` 권한 제거 → `activeTab`(사용자 발동 시 활성 탭 URL 접근)로 축소.
> 백그라운드의 탭 URL 감지는 쇼핑몰 `host_permissions`로 이미 커버되고, `tab.url`이 없으면
> `captureProductInner`가 안전하게 return하도록 방어되어 있어 기능 영향 없음. (T-90a 스토어 심사 대응)

## 2. host_permissions

| 패턴 | 용도 |
|------|------|
| `*://smartstore.naver.com/*` | 네이버 스마트스토어 가격 수집 |
| `*://brand.naver.com/*` | 네이버 브랜드 가격 수집 |
| `*://search.shopping.naver.com/*` | 네이버 쇼핑 검색/카탈로그 수집 |
| `*://www.coupang.com/*` | 쿠팡 수집 |
| `*://*.oliveyoung.co.kr/*` | 올리브영 수집 |
| `http://127.0.0.1:8000/*` | 로컬 서버 URL |
| `https://shop-wisebar.onrender.com/*` | 배포 서버 (Render) |

## 3. content_scripts 매치

`*://smartstore.naver.com/*`, `*://brand.naver.com/*`, `*://search.shopping.naver.com/*`, `*://www.coupang.com/*`, `*://*.oliveyoung.co.kr/*`
→ `common.js` + `content.js` + `swb-ui.js` (document_idle)

## 4. 심사 체크리스트 (AGENTS.md 21.1)

- [x] 권한 최소화 — `tabs` 제거(v0.10.2) → `activeTab` + 특정 호스트 한정, `<all_urls>` 미사용
- [x] content_security_policy에 `unsafe-eval` 없음 (명시하지 않음 = MV3 기본 `script-src 'self'`)
- [x] 기기ID(익명 UUID) 외 개인정보 미수집 — 토큰/계정 없음
- [x] `privacy_policy` URL 준비 — https://borasarang.github.io/Shop-WiseBar/privacy.html (스토어 대시보드 입력)
- [x] `webstore-publish.sh --dry-run` 통과 (v0.10.2)
- [x] 스토어 리스팅 자료 — `docs/store/STORE_LISTING.md`

## 5. 민감정보 저장 정책

- `chrome.storage.local`: `deviceId`(익명 UUID), `lastCapture`/`lastAlertAt`(쿨다운·커서) — 민감정보 아님
- `chrome.storage.session`: 알림 클릭 매핑(`nid:*`)만 — 세션 휘발
- 토큰/키 없음 — 서버 API 인증 없음 (익명 기기ID만)

## 6. 크로스브라우저 메모 (미적용)

- Firefox/Safari 미지원. 추후 확장 시 `browser.*` polyfill + `browser_specific_settings.gecko.id` 필요 (AGENTS.md 8.9장)