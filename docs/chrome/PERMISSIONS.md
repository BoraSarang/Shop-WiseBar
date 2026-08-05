# 똑바(Shop WiseBar) Chrome 확장 권한 정의서

> 버전: v0.9.2 · 플랫폼: Chrome MV3 (Edge/Whale 크로미움 호환) · 상위 규칙: AGENTS.md 21.1장

## 1. manifest 권한 (`extension/manifest.json`)

| 권한 | 사용치 | 최소 필요 여부 |
|------|--------|---------------|
| `storage` | 기기ID·수집 쿨다운·알림 커서·찜 캐시 (`chrome.storage.local`/`session`) | 필수 |
| `alarms` | 알림 5분 폴링 (`alert-poll`) | 필수 |
| `notifications` | 가격 하락/목표 도달/품절 브라우저 알림 | 필수 |
| `tabs` | 탭 URL 감지·현재 탭 추출·새 탭 열기 (`tabs.onUpdated/onActivated/query`) | 필수 |
| `webNavigation` | SPA 내비게이션 감지 (`onHistoryStateUpdated`) | 필수 |

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

- [x] 권한 최소화 — `activeTab`/`<all_urls>` 미사용, 특정 호스트 한정
- [x] content_security_policy에 `unsafe-eval` 없음 (명시하지 않음 = MV3 기본 `script-src 'self'`)
- [x] 기기ID(익명 UUID) 외 개인정보 미수집 — 토큰/계정 없음
- [ ] `privacy_policy` URL (스토어 등록 시 필수) — **미등록(개발 모드 로드 기준)**
- [ ] `webstore-publish.sh --dry-run` (P1 보류)

## 5. 민감정보 저장 정책

- `chrome.storage.local`: `deviceId`(익명 UUID), `lastCapture`/`lastAlertAt`(쿨다운·커서) — 민감정보 아님
- `chrome.storage.session`: 알림 클릭 매핑(`nid:*`)만 — 세션 휘발
- 토큰/키 없음 — 서버 API 인증 없음 (익명 기기ID만)

## 6. 크로스브라우저 메모 (미적용)

- Firefox/Safari 미지원. 추후 확장 시 `browser.*` polyfill + `browser_specific_settings.gecko.id` 필요 (AGENTS.md 8.9장)