# 똑바(Shop WiseBar) Chrome 확장 메시지 규약

> 버전: v0.9.2 · 플랫폼: Chrome MV3 · 상위 규칙: AGENTS.md 8.7장

## 1. 메시지 채널

| 채널 | 사용처 |
|------|--------|
| `chrome.runtime.sendMessage` | content script → background 서비스 워커 |
| `chrome.tabs.sendMessage` | background → content script (탭 추출) |
| `chrome.storage` | 상태 공유 (기기ID·쿨다운·커서·캐시) |

## 2. content → background (content.js → background.js)

### `OPEN_TAB` — 새 탭 열기
```json
{ "type": "OPEN_TAB", "url": "https://..." }
```
- 배경: `chrome.tabs.create` (플로팅/찜 목록 클릭)
- 응답: `{ ok: true }`

### `OPEN_OPTIONS` — 설정 페이지
```json
{ "type": "OPEN_OPTIONS" }
```
- 배경: `chrome.runtime.openOptionsPage()` (content script에선 직접 호출 불가)
- 응답: `{ ok: true }`

### `WATCHES_GET` — 찜 목록 조회 (찜 배지용)
```json
{ "type": "WATCHES_GET", "force": false }
```
- 배경: 30초 TTL 캐시 (`getWatchCache`) → 서버 `/devices/{id}/watches`
- 응답: `{ ok: true, watches: [...] }`
- `force: true`면 캐시 무시 재조회

### `WATCHES_INVALIDATE` — 찜 캐시 무효화
```json
{ "type": "WATCHES_INVALIDATE" }
```
- 배경: `watchCache = null` (찜 추가/해제 후 호출)
- 응답: `{ ok: true }`

### `RELATED_FOUND` — 스크롤 연관 상품 수집
```json
{ "type": "RELATED_FOUND", "items": [{ productID, mall, url, name, image, price }] }
```
- 배경: `uploadRelatedItems` — 상품 upsert + 가격 업로드 (세션 중복 Set 방지)
- 응답: `{ ok: true }`

### `DEBUG_LOG` — 디버그 로그 위임 (content → background) — v0.9.3
```json
{ "type": "DEBUG_LOG", "entry": { ts, level, scope: "content", text, url?, mall? } }
```
- 배경: `persistDebugLog` — `sender.tab`로 `tabId`/`url`/`mall` 태깅 후 `chrome.storage.local["debugLog"]` 중앙 기록
- 이유: content script는 storage를 직접 쓰지 않고 background에 위임 → **여러 쇼핑탭 로그가 한 저장소로 통일** (탭별 태그 관리)
- 응답: `{ ok: true }`

### `OPEN_DEBUG` — 디버그 창 열기 (popup → background) — v0.9.3
```json
{ "type": "OPEN_DEBUG" }
```
- 배경: `openDebugWindow` — `chrome.windows.create({type:"popup"})` 전용 디버그 창 열기/포커스 (단축키 `Ctrl+Shift+D`와 동일 동작)
- 응답: `{ ok: true }`

## 3. background → content (background.js → content.js)

### `EXTRACT` — 현재 탭 상품 추출
```json
{ "type": "EXTRACT", "url": "현재 탭 URL" }
```
- content: `Extractor.extract(parsed.mall, url)` — 가격/제목/이미지/variant/품절
- 응답: `{ ok: true, parsed, data }`
- `data`: `{ price, title, image, variant, soldOut }`
- url 필수 — 쿠팡 SPA가 로드 후 vendorItemId를 URL에서 제거하므로 캡처 시점 URL로 variant 확보

### `EXTRACT_RELATED` — 연관/목록 카드 수집
```json
{ "type": "EXTRACT_RELATED" }
```
- content: `collectCurrentRelated()` — 상품/목록 페이지 카드 (1회 최대 40개)
- 응답: `{ ok: true, items: [...] }` / `{ ok: false, code: "E-EXT-URL-2001" }`

## 4. 상태 스토리지 규약

| 키 | 위치 | 용도 |
|----|------|------|
| `deviceId` | storage.local | 익명 기기 UUID (crypto.randomUUID) |
| `lastCapture` | storage.local | `{ key, at }` — 동일 상품 10분 쿨다운 |
| `lastRelated` | storage.local | `{ key, at }` — 연관 수집 10분 쿨다운 |
| `lastAlertAt` | storage.local | 알림 폴링 since 커서 (ISO) |
| `nid:{notificationId}` | storage.session | 알림 클릭 → 상품 ID 매핑 |
| `debugEnabled` | storage.local | 디버그 로그 기록 활성/비활성 (옵션 페이지 스위치) — v0.9.3 |
| `debugLog` | storage.local | 디버그 로그 중앙 저장소 (최대 2000줄 FIFO) — v0.9.3 |

## 5. 오류 규약

- content 추출 실패: `{ ok: false, code: "E-EXT-URL-2001" }` (지원하지 않는 페이지) / `E-EXT-VALID-3001` (추출 실패)
- 서버 통신 실패: `E-EXT-NET-1001` — 사용자 노출은 `error_message_ko.json` 참조
- 오프라인: 서버 다운 시 수집 보류(다음 방문 재시도), 찜 상태는 storage 캐시 (PRD 6장)