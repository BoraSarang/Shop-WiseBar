# 똑바(Shop WiseBar) 변경 이력

## v0.9.8 (2026-08-05) — [extension] 옵션 페이지 서버 장애 안내 + GitHub 릴리즈 링크 추가 + [확인] Edge 로드

### 옵션 페이지 — 서버 접속 실패 시 안내 문구 + GitHub 링크
- **배경**: 사용자가 서버 URL을 변경할 수 없도록 설계(서버 주소는 `common.js`의 `SWB_CONFIG` 단일 관리). 업데이트 시 자동으로 서버 주소가 바뀌므로 사용자에게 주소 변경을 요청하는 것은 타당하지 않음
- **추가**: 서버 `/health` 확인 실패 시 "서버에 접속할 수 없습니다. 문제가 있는지 확인해 보세요." 안내 박스 + **새 버전 확인 (GitHub 릴리즈)** / **GitHub 저장소** 링크 (options.html: err-box, options.js: loadServerStatus 실패 시 errBox 표시)
- 검증: 정상 상태 → errBox 숨김(none) + "연결됨". `/health` 차단 → errBox 표시(block) + "연결 실패 (E-EXT-NET-1001)". 옵션 페이지 UI는 서버 주소 표시 전용(수정 불가) 유지

### 확인 — Microsoft Edge 확장 로드 확인
- Edge(151.0.4129.59) Profile 1의 `Secure Preferences`에서 확장 ID `dmdgnfaihmeagfopdabippjnbgngafhj`가 `/Users/lee/Documents/Apps/Shop WiseBar/extension` 경로로 unpacked(개발자 모드) 로드 확인 — 똑바 확장 정상 로드

## v0.9.7 (2026-08-05) — [extension] 플로팅 찜 목록 삭제 버그 수정 + 가격 추이 찜 해제 시 목표가 행 숨김 수정

### 플로팅 — 찜 목록 관리에서 삭제 버튼이 동작하지 않던 버그 수정
- **버그**: `swb-ui.js`의 `renderWatchList`에서 `deleteWatch(deviceId, w.product_id)` 호출 — `deviceId`가 해당 스코프에 없어 **ReferenceError 발생 → 삭제 무시**되고 목록이 그대로 남음
- **수정**: `deleteWatch(productId)`로 시그니처 단순화 + 함수 내부에서 `getDeviceId()` 직접 조회 (라인 1282). 호출부는 `await deleteWatch(w.product_id)` (라인 1244)
- 서버 측은 정상 — 로컬 서버 `DELETE /devices/{did}/watches/{pid}` 204 응답 확인
- E2E 환경 한계: Playwright `page.evaluate`는 Main World라 확장 content script(Isolated World)의 `chrome.storage`에 접근 불가 → 목록 조회가 비어보이는 것은 테스트 환경 문제. 실제 확장은 `storage` 권한으로 정상 동작

### 플로팅 — 가격 추이에서 찜 해제 후 목표가 행이 남아있던 버그 수정
- **버그**: shadow DOM에는 범용 `.hidden { display:none }` 규칙이 없어, 찜 해제 시 목표가 행에 `hidden` 클래스를 추가해도 `display:flex`가 유지되어 **행이 사라지지 않음**
- **수정**: `.swb-target-row.hidden { display: none; }` 규칙 추가 (라인 136). 같은 원인의 `.swb-related.hidden { display: none; }` 규칙도 함께 추가 (라인 173, v0.9.6에서 사용 중이었으나 규칙 누락)

## v0.9.6 (2026-08-05) — [extension] 스크롤 연관 관계 저장 + 핫딜 상단 배치 + [data] 테스트 데이터 정리

### 확장 — 스크롤 연관 상품의 관계 그래프 저장 버그 수정
- **버그**: 연관 상품은 ①페이지 로드 직후(`captureRelated`, parentId 전달)와 ②스크롤로 새 카드 로드 시(`RELATED_FOUND`) 두 경로로 수집된다. 그런데 스크롤 경로는 parentId 없이 `uploadRelatedItems(items, "scroll")`를 호출해 **관계(relations)에 저장되지 않고 products 테이블에만 등록**됐다 — 함께 본 상품 추천 데이터에 구멍
- **수정**: `content.js` — `RELATED_FOUND` 메시지에 현재 페이지의 `parentId`(상품ID) 포함. `background.js` — `uploadRelatedItems(msg.items, "scroll", msg.parentId || null)`로 전달. 상품 페이지면 스크롤 카드도 관계 그래프에 저장. 검색/목록 페이지는 parentId 없음 유지
- 성능 영향 없음 (기존에 이미 저장되던 스크롤 카드의 업로드 경로에 parentId만 추가)

### 팝업 — 핫딜 섹션을 함께 본 상품 위로 재배치
- **이유**: 초기 불만인 "핫딜이 안 보인다"의 근본 해결. 기존 순서 current→related→deals라 함께 본 상품 5개가 로드되면 핫딜이 아래로 밀려 스크롤해야 보였음
- **수정**: `popup.html` 섹션 순서를 current→**deals(핫딜)**→related(함께 본 상품)로 변경. `deals`는 `flex-shrink:0`이라 항상 상단에 노출, 함께 본 상품은 그 아래에서 스크롤로 접근
- 렌더링 검증: Whale 팝업에서 sectionOrder `[current, deals, related]` 확인

### 데이터 — 로컬 서버 테스트 데이터 정리 (SQLite shopwisebar.db)
- **제거 대상**: 모든 명시적 테스트 상품(`rel-src-1`/`rel-tgt-1~5`, `coupang:rel-src`/`rel-tgt`, `local-a`/`local-b`, `coupang:target*` 목표가 테스트, `TESTLONGNAME_0002`) + 테스트 관계 7건 + `test-*` 디바이스 13개와 그 watches/alerts + 테스트 가격 포인트/통계
- **주의**: `coupang:111/222/333`(키보드A/마우스B/손목받침C)도 이름상 테스트로 판단되어 함께 정리
- **결과**: products 530→506, relations 10→0, devices 16→3(실제). 실제 디바이스(watches 4건, alerts 3건)는 유지
- 백업: `/var/folders/3_/.../T/opencode/shopwisebar_backup_*.db` (파괴적 변경 대비)

## v0.9.5 (2026-08-05) — [extension] 팝업에서 찜 목록 제거 + 메인 스크롤 추가 (함께 본 상품·핫딜 공간 확보)

### 팝업 — 찜 목록 섹션 제거
- **이유**: 팝업 세로 공간(600px)이 부족해 함께 본 상품 5개가 화면에 아예 안 보이는 문제. 찜 목록은 플로팅 메뉴(찜목록 아이콘)에 이미 존재해 기능 손실 없음
- **제거**: `popup.html`의 `#listSection`(찜 목록+몰 필터+접기 토글)과 `#confirmDlg` 삭제
- **코드 정리**: `popup.js` — `loadList()`, `renderList()`, 몰 필터 이벤트, `listToggle` 리스너, `confirmDialog`(찜 삭제 확인용), `staleCheckLabel()`, `watchCache`/`watchMallFilter` 제거. `mallMeta`/`mallBadgeHtml`은 연관 상품·핫딜에서 공용으로 쓰므로 유지. watchBtn/targetClear/init의 `loadList()` 호출 제거
- **스타일 정리**: `popup.css` — 찜 목록 전용 스타일(`.watch-item`/`.watch-price`/`.watch-check`/`.mall-filter`/`.watch-unwatch` 등) 제거, 연관·핫딜 공용(`.watch-thumb`/`.watch-badge`/`.watch-name`)과 함께 본 상품 토글(`.list-toggle`)은 유지

### 팝업 — 메인 스크롤 추가 + 레이아웃 정리
- **이유**: 찜 목록 제거 후에도 current+related+deals 섹션이 600px를 넘으면 핫딜이 잘림
- **수정**: `body`에 `overflow-y: auto` 추가 — 섹션이 화면을 벗어나면 팝업 전체가 스크롤
- **핫딜 목록 내부 스크롤 제거**: `.deal-list`의 `max-height: 168px; overflow-y: auto` 제거 — v0.7.6의 "찜 목록 공간 확보" 목적이 사라져 메인 스크롤로 전체 표시
- **헤더 sticky 유지 (v0.9.5)**: 스크롤해도 헤더(똑바 로고)는 최상단 고정 유지 — v0.9.5 중 sticky 해제를 시도했으나 사용자 선호로 복원
- **스크롤바 커스텀**: 기본 OS 스크롤바(투박) 대신 6px 얇은 스크롤바로 대체
- **섹션 타이틀/여백 통일**: 핫딜(`.deals`) 패딩 10px→12px 상하 일관, `#related` 배경 흰색 + 타이틀 13px→12px로 핫딜과 통일 — 섹션 전환 시 높이 점프 없음
- 렌더링 검증: Whale 팝업에서 body `overflow-y:auto` + 얇은 스크롤바, 콘텐츠 채웠을 때 scrollable + 스크롤 이동 확인. **핫딜 섹션이 viewport 하단 밖에 있지 않음**(스크롤 없이도 핫딜 헤더 노출). `#listSection`/`#confirmDlg` 부재 확인
- 성능 영향 없음 (API 호출 1회 감소: `/devices/{did}/watches`)

## v0.9.4 (2026-08-05) — [extension] 플로팅 메뉴 직각 배치 + 페이지 정보(제작자/버전) + [server] alerts 500 수정

### 플로팅 메뉴 재배치 (ext) — 직각 배치
- **배치 변경**: 기존 FAB 왼쪽 세로 6개 나열 → **FAB 중심 직각 배치**. **메뉴 원점을 FAB 중심(`right:calc(20px+23px); bottom:25vh`)으로 이동**해 좌표가 FAB 세로축과 어긋나던 문제(왼쪽 치우침) 해결. 최종 배치: **위=핫딜·알림, 왼쪽=가격추이·찜목록(FAB에 가깝게 x=-60), 아래=설정·사용법·디버그** — 핵심 기능은 왼쪽, 나머지는 위/아래로 분산
- **라벨 겹침 수정**: 위/아래 아이콘 간격 48px → **72px** (라벨 높이 20px+마진이 이웃 아이콘과 겹치던 문제). **위 그룹(핫딜·알림) 라벨 방향 left로** — 아이템 위로 나가며 위쪽 이웃(알림) 아이콘과 겹치던 것을 왼쪽 배치로 해결(왼쪽 열과 y 범위 상이해 충돌 없음). 아래 그룹은 아이템 아래 표시 유지
- **애니메이션**: 메뉴 열림 시 order 순서(위→왼쪽→아래) 스태거 펼침, 닫힘 시 딜레이 리셋. FAB 180도 회전 유지
- **디버그 아이콘 실시간 반영**: `debugEnabled` 토글 시 `chrome.storage.onChanged`로 **새로고침 없이** 메뉴에 디버그(버그 아이콘) 즉시 추가/제거
- **버그 아이콘 추가 (ext)**: `ICON.bug` SVG 신규

### 확장 — 가격/관계 3회 중복 업로드 방지 (동시 실행 잠금)
- **원인**: `tabs.onUpdated(complete)` + `tabs.onActivated` + `webNavigation.onHistoryStateUpdated`가 탭 전환 직후 거의 동시에 `captureProduct`를 호출. `lastCapture` 쿨다운은 **비동기 `chrome.storage.local.get` 경합**으로 막지 못해 같은 상품이 **정확히 3회** `/products`+`/prices` 업로드 → 서버에서 같은 초 UNIQUE(product_id, captured_at) 충돌로 **prices 500**, 관계 저장도 동시 POST로 **uq_rel_pair 충돌 500** 유발
- **수정**: `background.js` — `withCaptureLock()` 인메모리 Map으로 **동일 탭의 captureProduct를 직렬화** (captureProductInner 리팩터링)
- **연관 상품 업로드 병렬화**: 순차 `await` 루프(상품당 ~3.5s)가 40개면 2분 넘게 걸려 스크롤 직후 대기 시간이 길었다 → **`mapLimit(items, 5)` 동시성 제한 병렬 처리**로 단축 (서버 부하 억제)

### 서버 — alerts 500 수정 (PostgreSQL naive/aware 비교)
- **원인**: `GET /devices/{did}/alerts`가 실서버(PostgreSQL)에서만 HTTP 500. `DateTime(timezone=True)` 컬럼이 PG에선 **aware datetime**으로 반환되는데 `since`는 `replace(tzinfo=None)`으로 **naive** 처리 → `latest.captured_at <= since` 비교 시 `TypeError: can't compare offset-naive and offset-aware datetimes`. SQLite는 naive라 로컬 재현 불가였음
- **수정**: `watches.py` — `_naive()` 헬퍼로 비교 시 항상 naive 통일 (sold_out_at/captured_at)
- **가격 중복 업로드 500 수정**: `products.py` — 같은 초 중복 POST 시 `UNIQUE(product_id, captured_at)` `IntegrityError` 발생 → PG 세션이 requires-rollback 상태가 되어 commit 시 500. **IntegrityError 시 즉시 rollback 후 성공 응답** 반환 (중복 요청이므로 직전 요청이 갱신 완료). 로컬 동시 3회 POST → 3건 모두 201 확인
- **관계 저장 동시성 500 수정**: `relations.py` — 같은 source로 동시 POST 시 existing 조회 시점에 없던 쌍이 먼저 INSERT돼 `uq_rel_pair` 충돌 → **IntegrityError 시 rollback 후 기존 행 weight 증가만 수행**하고 성공 처리. 로컬 동시 3회 POST → 3건 모두 200 확인(수정 전 500 재현)
- **추가 성능 최적화**: POST `/products`는 확장이 응답 body를 쓰지 않는데 통계 쿼리 5개(_product_out)를 실행 → **기본 필드만 반환**으로 변경 — 연관 카드 N개 순차 업로드의 쿼리 × N 지연 제거 (로컬 31ms 확인)

### 페이지 정보 표시 (ext)
- **옵션 페이지**: "확장 버전" 행 추가 (`chrome.runtime.getManifest().version`) + 하단에 제작자(BoRaSaRang)·문의(이메일)·GitHub 링크 카드
- **사용법(onboarding) 페이지**: 하단에 제작자·문의 이메일·GitHub 소스 코드 카드 추가
- **팝업 헤더 정리**: `.header-desc`/`.status` ellipsis 처리 + 로딩 안내 문구 단축 — 320px 폭에서 줄바꿈 방지
- 성능 영향 없음 (순수 렌더링/CSS, storage 이벤트 1회만)

## v0.9.3 (2026-08-05) — [extension+server] 전용 디버그 창 + 중앙 로그 + 연관 업로드 500 수정 (T-82→T-83)

### 확장 — 전용 디버그 창 & 중앙 로그 (T-83)
- **중앙 로그 스토리지 (ext)**: `debug.js` 전면 개편 — 모든 로그가 `chrome.storage.local["debugLog"]`에 **중앙 누적**(최대 2000줄 FIFO). **SW 종료/팝업 닫기/탭 이동과 무관하게 지우기 전까지 유지** (기존 메모리 링 버퍼는 휘발 문제 — T-82 옵션 A 대체)
- **전용 디버그 창 (ext)**: `debug-view.html/.css/.js` 신규 — `chrome.windows.create({type:"popup"})` OS 레벨 분리 창(우상단 고정, 1.5배 폭). **어느 탭을 봐도 항상 떠 있고** 닫기 전까지 계속 누적/2초 자동 갱신. **단축키 mac `Command+D` / 그 외 `Ctrl+Shift+Y`** 토글(manifest commands, 웨일 확인 완료). 로그 뷰어: 색상(ERROR/WARN/PERF/DEBUG) + 자동스크롤 + 레벨·몰·탭 필터 + 검색 + 전체 복사 + 지우기 + 일시정지
- **다중 탭 로그 통일 (ext)**: content script는 storage를 직접 쓰지 않고 `DEBUG_LOG` 메시지로 background에 위임 → background가 `sender.tab`로 **탭ID/url/몰 태깅** 후 중앙 기록 → **쇼핑탭 여러 개를 오가도 로그가 하나로 모임** (탭 필터로 구분)
- **팝업 정리 (ext)**: 내장 `debugPanel`·토글·복사/숨기기 제거 → 헤더 🛠 "디버그 창 열기" 버튼(`OPEN_DEBUG` 메시지). **`debugEnabled`(설정 '디버그 패널 표시')가 켜져 있을 때만 🛠 버튼 노출**, 해제 시 숨김. `options.js` 스위치 유지(로그 on/off)
- **설정에 단축키 표기 (ext)**: 옵션 페이지 디버그 카드에 단축키(⌘D / Ctrl+Shift+Y) 표시 + kbd 스타일 — `chrome://extensions/shortcuts`에서 변경 안내
- **전처리 성능 (ext)**: content 위임은 즉시(비동기), ext(background/popup/창)는 디바운스(300ms) 배치 저장 — 로그마다 storage set 없음

### 서버 — 연관 상품 업로드 HTTP 500 수정
- **원인**: `POST /products`에서 `name`/`url`/`image`가 DB 컬럼 최대 길이(`String(512/1024)`)를 넘으면 **Postgres는 오류 → 500**(SQLite는 무시해 로컬 재현 불가). 네이버 연관 카드의 장황한 상품명이 512자 초과해 '연관 상품 업로드 실패 HTTP 500' + 관계 저장 누락 발생
- **수정**: `server/app/routers/products.py` — 저장 전 `name[:512]`/`url[:1024]`/`image[:1024]` 클램프. 실서버 600자 name 요청 500→201 확인(로컬 + Render 재현)
- 성능 영향 없음. `node --check`/`py_compile` 통과

## v0.9.2 (2026-08-04) — [server+extension] 목표가 UI 디자인 통일 + 목표가 해제 버그 수정

- **목표가 해제 버그 수정 (server)**: `PUT /devices/{did}/watches/{pid}`에 `target_price`가 없면(해제 요청) **기존 값을 유지**해 해제가 안 되던 문제 → 명시적으로 `None` 초기화 — 팝업/플로팅의 `설정 해제` 버튼·`PUT {}` 요청이 실제로 목표가를 지우도록 (775724a)
- **팝업 목표가 행 UX (ext)**: "현재 가격이 기본으로 채워져요" 힌트 문구 제거 → **목표가 상태 라벨**(`N원 이하 알림 중` 파랑 강조 / `목표가 미설정`) 우측 정렬 + **설정 해제** 버튼(목표가 있을 때만 활성) + 입력/버튼 우측 정렬
- **찜 목록 가격+상태 한 줄 정렬 (ext)**: `watch-price-row` flex — 가격 왼쪽, 상태(품절/목표가 알림/확인 필요) 오른쪽 정렬
- **품절 행 배경 (ext)**: `.sold-out-row` 연분홍 배경 + hover 강조 (팝업 + 플로팅 swb-ui 동일)
- **함께 본 상품 접기 (ext)**: 힌트 문구 "이 상품을 본 분들이 함께 본 상품"으로 변경 + 헤더에 접이기 토글(▾/▸, `relatedToggle`/`.collapsed`)
- **아이콘 교체 (ext)**: `scripts/gen_icon.py` 신규 생성기 — 남색 하락 화살표 v2 (icon16/48/128 PNG 리사이즈)
- 성능 영향 없음 (순수 CSS/JS 렌더 변경, 서버는 PUT 분기 1줄)

## v0.9.1 (2026-08-04) — [server+extension] 목표가 알림 + 품절 감지 + 추천/추이 UX

- **목표가 알림**: 찜에 목표가 설정 가능 (`Watch.target_price` + 팝업 입력 UI) — 가격이 목표가 이하로 내려가면 `target_reached` 알림 (직전 가격이 목표가 이상일 때만 1회, 회복 후 재하락 시 재알림)
- **품절 감지**: 상품 페이지 품절 시 확장이 자동 보고 (`Product.sold_out_at` + `POST /products/{id}/sold-out`) → 찜 목록 '품절' 배지 + `sold_out` 알림 (재판매 시 가격 캡처가 자동 해제)
- **컬럼 마이그레이션**: startup `_ensure_columns` — PostgreSQL `ADD COLUMN IF NOT EXISTS` / SQLite PRAGMA+ALTER (create_all 한계 보완)
- **버그 수정**: ① 품절 상품이 목표가 검사를 재수행해 알림 무한 반복 → 품절이면 하락/목표가 검사 생략 ② since와 캡처 시각이 동일(초 절단)하면 재감지 → `<=` 비교 ③ `content.js` isSoldOut이 쿠팡 if 블록 안 `const`로 선언돼 블록 밖 return에서 ReferenceError → 쿠팡 추이 패널 로딩 중단 (함수 레벨 `let`로 수정, 883e187)
- **관계 저장 500 수정**: `POST /products/relations`가 targets 중복(같은 상품이 여러 연관 섹션에 노출)을 제거하지 않아 `uq_rel_pair` unique 제약 위반 → 500 — 확장 captureRelated(40개 카드)의 관계 저장이 항상 실패해 '함께 본 상품'이 비어 있었음. `dict.fromkeys`로 중복 제거 (0ffca63) — 로컬/실서버 중복 target 200 확인, 미레오 9590025132 연관 3건 weight 3 수집 확인
- **관계 기반 추천 확장**: 팝업 '함께 본 상품' 섹션 (GET /related 재사용, 5개, 클릭 시 새 탭)
- **추이 그래프 UX**: 최저가 점선 표시선 + 하락 구간 파란 굵은 선/상승·평탄 회색 + 최저/최고점 마커
- **알림 뷰 배지**: 목표 도달(보라)/품절(빨강)/하락(파랑) 타입별 표시
- 성능: 알림 감지는 상품당 500포인트 제한 조회 유지, 신규 컬럼은 인덱스 불필요(소량 조회)

## v0.9.0 (2026-08-04) — [server+extension] Phase 3: 상품 관계 그래프 (함께 본 상품)

- **연관 상품을 관계로 저장**: 상품 페이지 방문 시 연관/추천 섹션의 카드를 부모 상품과 연결 (`product_relations` 테이블, 신규) — 같은 쌍이 반복 노출되면 weight(강도) 증가, 무방향 그래프 (A→B 2회 + B→A 1회 = 강도 3으로 합산)
- **API**: `POST /products/relations` (bulk upsert, weight += 1) / `GET /products/{id}/related?limit=` (양방향 합산, weight 내림차순, 상품 정보 포함)
- **확장**: background.js `captureRelated`가 parentId를 전달해 관계 업로드 (목록 페이지는 관계 저장 안 함), 플로팅 추이 패널에 **"함께 본 상품"** 섹션 — 연관 5개, 이름+현재가, 클릭 시 새 탭 오픈
- 로컬 E2E: 관계 저장(중복 weight 증가) → 양방향 합산 조회 PASS (2+1=3, 2)
- 성능: 관계 저장은 상품 페이지 1회 호출(최대 10쌍), 조회는 인덱스(PK 유니크) 사용

## v0.8.28 (2026-08-04) — [extension] 핫딜 최저가 배지 표시 (reason=low)

- 서버 v0.8.26이 하락 상품 부족 시 **역대 최저가 갱신 상품**(reason=low)으로 채우는데, 팝업/플로팅 핫딜 목록이 `▼ 0%`로 표시해 어색
- **수정**: `popup.js` + `swb-ui.js` — `d.reason === "low"`면 `▼ 0%` 대신 **"최저가"** 배지 표시
- 성능 영향 없음

## v0.8.27 (2026-08-04) — [server] 가격 삭제 API variant 지원 / [extension] 쿠팡 품절 price-container 불신

- **알림 오탐 발견**: 오리온 황치즈칩(9648038896)이 variant=None 9,880원(품절 잔존, 23:57)을 다시 저장 → variant=None 그룹에서 20,530(수동) vs 9,880 = **52% 하락 오탐 알림** — v0.8.20에서 지웠던 잔존값이 재수집된 원인: content.js가 품절이어도 `.price-container`(잔존 판매가)를 신뢰
- **수정**:
  - `content.js`: 쿠팡 분기 `if (pcEl && !isSoldOut)` — 품절이면 price-container 불신 (스킵)
  - `products.py`: `DELETE /products/{id}/prices/{price}?variant=` 추가 — variant 생략=전체, `__none__`=NULL variant, 그 외=해당 variant만 (실제 딜 variant 보존하며 정밀 정리)
- **정리**: 오리온 variant=None 9,880 / 20,530(수동) / 12,345(VARIANT_TEST_001) 삭제 — variant=95728194224의 실제 9,880과 variant=95826327022의 20,530×2는 보존
- 알림 재확인: 오탐 제거, 정상 하락(10,600→10,520)만 남음

## v0.8.26 (2026-08-04) — [server] 핫딜 추천 강화 (역대 최저가 갱신 채움 + reason)

- 하락 상품(drop 5%+)이 부족할 때 **역대 최저가를 갱신한 상품**(기간 전 최저가 대비 ≤)으로 부족분 채움
- 같은 product_id의 variant 중복은 drop% 최대 1건만 (v0.8.21 규칙 유지)
- 응답에 `reason` 필드 추가: `drop`(하락) / `low`(최저가 갱신)
- 로컬 검증: 7일/30일 drop 10건 정상, variant 중복 없음, low 쿼리 문법 OK
- 실서버: 현재 하락 상품 없음(전부 동일가 2포인트) → 0개 반환 정상 (데이터 축적 후 동작)

## v0.8.25 (2026-08-04) — [extension] 추이 패널 로딩 중 이전 값 초기화

- **문제**: 가격 추이 로딩 중(서버 조회 동안) 이전 상품의 가격/최저·최고가/이력 건수/기간 라벨이 그대로 남아 있다가 로딩 완료 후 바뀌어 애매하게 보임
- **수정**: `loadTrend`의 로딩 인디케이터 표시 시점에 현재 가격(—)/변동/최저·최고/이력 건수/x축 라벨을 전부 비움 → 로딩 완료 후 새 값으로 채움
- 성능 영향 없음 (DOM textContent 6회)

## v0.8.24 (2026-08-04) — [extension] 추이 패널 크래시 수정 (extract url 인자 방어)

- **버그**: v0.8.23에서 `Extractor.extract`가 `url.match()`를 사용하도록 바뀌었는데, **플로팅 추이 패널(swb-ui.js)은 url 인자 없이 `extract(parsed.mall)`로 호출** → `undefined.match` 크래시 → `loadTrend`가 로딩 표시(가격 이력 불러오는 중…)를 띄우기 전에 중단 (사용자: "웨일에선 로딩중도 안뜸", 브랜드 스토어 NUPHY AIR60 11106441044 사례 — 크롬은 아직 구버전이라 정상 동작)
- **수정**:
  - `content.js`: `url || window.location.href` 기본값 방어 (어떤 경로에서 호출돼도 안전)
  - `swb-ui.js`: 추이 패널에서 `extract(parsed.mall, location.href)`로 현재 URL 명시 전달 (쿠팡 variant 추출 정확도도 함께 확보)
- CDP 재현: url 미전달 시 `Cannot read properties of undefined (reading 'match')` 크래시 확정 → 수정 후 기본값 경로 검증
- 성능 영향 없음

## v0.8.23 (2026-08-04) — [extension] 스마트스토어 SPA 전환 가격 오염 방지 (JSON-LD 검증)

- **원인 규명 (CDP 실측)**: 독거미 L99 키보드 `12270743644`(화이트 투명블루 102,020원)와 `12270743646`(화이트그레이 109,520원)은 **같은 제품의 색상별 개별 상품** — 색상/옵션 클릭이 `history.pushState`로 다른 상품 페이지로 이동 (사용자: "주소가 바뀌네")
- **레이스**: URL이 먼저 바뀌고 DOM이 늦게 교체되는 동안 캡처가 발생 → 옛 상품 가격이 새 product_id로 저장 (서버 기록: 46에 102,020 5회 / 44에 109,520 4회 — 양방향 오염) → 팝업(서버 last_price)이 틀린 가격 표시
- **수정**: `content.js` 네이버 분기 — head의 JSON-LD(`mpn`/`productID`)와 URL 상품번호가 **불일치하면 price=null**(캡처 스킵), 렌더 완료 후에는 JSON-LD `offers.price`를 **정확한 현재 판매가로 우선 사용** (기존 "상품 가격" 라벨 로직은 폴백)
- **오염 정리**: 46의 102,020(5개) / 44의 109,520(4개) 삭제 → last_price 각각 109,520 / 102,020 정상 복구
- 성능 영향 없음 (JSON-LD 파싱 1회)

## v0.8.22 (2026-08-04) — [extension] 쿠팡 할인 상품 정가 오탐 수정 (일반할인가 우선)

- **정가가 판매가로 저장되던 버그 수정**: 할인 상품(와우할인가/일반할인가)의 `.price-container`는 `"와우할인가 44% 22,500원 12,380원 할인받기 일반할인가 44% 22,500원 12,510원"` 구조 — **정가(22,500)가 첫 금액**이라 기존 첫 금액 규칙이 정가를 저장 (사용자 실측: 오트밀 미니바이트 12,510이 22,500으로 표시)
  - CDP 실측으로 `"일반할인가"` 섹션의 **마지막 금액 = 실제 구매가** 확정 → 라벨 유무 분기 (라벨 없으면 기존 첫 금액 규칙 — 일반 상품/오리온 호환)
- 오염 정리: 9677792314의 22,500(정가)/12,380(와우할인가) 삭제 — 새 캡처부터 12,510 저장
- CDP 검증: 오트밀 → 12,510 ✓ / 오리온 → 21,930 ✓
- 성능 영향 없음

## v0.8.21 (2026-08-04) — [extension] 팝업 핫딜 렌더 HTML 문자 노출 수정

- **팝업 핫딜 이전가 HTML 문자 노출 수정**: `deal-before`(이전 가격)를 `.textContent`에 HTML 문자열(`<span class="deal-before">…</span>`)로 넣어 **태그가 그대로 텍스트로 표시**되던 버그 — 실제 화면에 `@에스쁘아 워터 스플래쉬 선크림… 9,000원 <span class="deal-before">40,000원</span>`처럼 노출됨 — `createElement` + `textContent`로 수정 (swb-ui.js와 동일 패턴)
- 사용자 실측 예시 기반 수정, 찜 목록 렌더는 정상 확인

## v0.8.20 (2026-08-04) — [server] 쿠팡 variant=None 핫딜 오탐 제거 + variant 응답 누락 수정

- **핫딜 오탐 수정 (핫딜이 아닌데 핫딜로 표시되는 상품들)**: 쿠팡 variant(None) 파티션에 서로 다른 수량 옵션 가격(1개 10,980 / 2개 20,530 / 3개 27,530 / 품절 잔존 9,880)이 섞여 있어 옵션 간 가격 차이를 "하락"으로 계산 → 오리온 51.9%(9880←20530, 실제로는 서로 다른 옵션) 같은 오탐 발생. **쿠팡은 variant 미지정 포인트를 핫딜 계산에서 제외** (네이버/올리브영은 variant 개념이 없어 None 그대로 유효 — 포함)
  - CDP 실측 확인: variant는 DB에 정상 저장되고 있었음 (GET /prices 응답에서만 누락돼 "None인 것처럼" 보임)
- **GET /prices 응답 variant 누락 수정**: `GET /products/{id}/prices` 응답에 variant 필드가 빠져 있어 팝업/추이 그래프가 variant 정보를 받지 못하던 버그 (products.py:218)
- 로컬 SQLite 검증: 쿠팡 variant 하락(V1 9880←20530)만 검출, None 파티션 하락(20530←27530) 제외, 네이버 None 하락은 유지 — PASS
- 성능 영향: 없음 (기존 인덱스)

## v0.8.19 (2026-08-04) — [extension+server] variant(수량 옵션)별 가격 전면 분리

- **핫딜 누락 수정**: 같은 가격이 초 단위로 중복 저장(동시 캡처 race)되면 직전 포인트가 같은 가격이 되어 하락률 0%로 계산 — 오리온 실질 52% 하락(20,530→9,880)이 핫딜에서 사라진 문제. 연속 동일 가격 그룹을 압축 후 비교
- **핫딜 variant 분리**: variant(쿠팡 수량 묶음/딜)별 PARTITION — variant A의 하락을 variant B 가격과 섞어 계산하지 않음
- **서버 variant 조회**: `GET /products/{id}?variant=`, `GET /products/{id}/prices?variant=` — variant 지정 시 해당 옵션의 last_price/최저가/평균가/이력만 응답 (지정 없으면 기존 전체 동작, 네이버/올리브 영향 없음)
- **팝업/추이 variant 반영**: 팝업 EXTRACT에 url 전달 + 현재 탭 variant로 서버 조회 — 수량 변경 시 배지/통계/그래프가 해당 수량 기준으로 표시
- 성능 영향: 없음 (기존 인덱스로 variant 필터 커버)

## v0.8.18 (2026-08-04) — [extension+server] 이름 갱신 출처 구분 (카드 이름 오염 방지)

- **회귀 방지**: v0.8.17의 "이름 항상 갱신"이 검색/연관 카드 캡처(짧은 카드 이름)가 상세 페이지 이름을 덮어쓰는 문제 유발 가능 — `ProductUpsertIn.source` 추가
  - `detail`(상세 페이지 실시간 .product-title) → 항상 갱신 (수량 반영)
  - `card`(검색/연관 카드) → 최초 1회만 (기존 정책 유지 — 네이버/올리브 포함)
- 구버전 확장(요청에 source 없음)은 최초 1회 동작 유지 (하위 호환)
- 성능 영향 없음

## v0.8.17 (2026-08-04) — [extension+server] 쿠팡 수량 변경 시 상품명 실시간 반영

- **상품명 실시간 추출**: og:title은 페이지 로드 시 고정(수량 변경 미반영, "1개" 유지) — CDP 실측으로 쿠팡 실시간 상품명 요소 `H1.product-title` 확정 (수량 클릭 시 "오리온 황치즈칩 쿠키, 256g, 1개/2개/3개" 실시간 변경) — EXTRACT title을 `.product-title` 우선으로 교체
- **팝업/플로팅 추이 자동 해결**: 두 화면 모두 EXTRACT title 사용 (popup.js liveTitle, swb-ui.js splitTitle)
- **찜 목록 이름 갱신**: 서버가 이름을 최초 1회만 저장하던 정책 → 매 캡처 최신 이름 반영 — 찜 목록/등록에 수량 반영 이름 표시
- 성능 영향 없음

## v0.8.16 (2026-08-04) — [server] 오염 포인트 삭제 시 last_price 재계산

- **DELETE 후 last_price 잔존 버그 수정**: 오염 가격 포인트(24,200원 등)를 삭제해도 `product.last_price`가 삭제된 값으로 남아 팝업(서버 last_price 표시)이 삭제값을 계속 보여주던 문제 — 삭제된 값이 last_price면 **최근 남은 포인트로 자동 복구**
- 정리: 오리온 24,200(추천 카드)/13,800×2/11,900 삭제 + last_price 20,530으로 수동 정상화
- 성능 영향 없음

## v0.8.15 (2026-08-04) — [extension] 쿠팡 판매가 요소 직접 추출 (body 첫 금액 폴백 제거)

- **판매가 추출 1순위 확정**: CDP 실측(웨일 9222)으로 쿠팡 판매가는 `.price-container` 요소 1개에 항상 존재함을 확인 (오리온 1개 10,980 / 2개 20,530 / 3개 27,530원 전부 정확)
- **body 첫 금액 폴백 제거**: lazy 로드되는 추천 카드(글로벌특가 등)의 14,900/13,800/11,900/12,510원이 body에 끼어들어 팝업 EXTRACT·플로팅 추이에서 오탐 표시되던 문제 — 판매가 요소가 없으면 수집 스킵
- **vendorItemId = 수량 묶음 옵션 확인**: 95788422542(1개)=10,980 / 95826327022(2개)=20,530 / 95871591795(3개)=27,530 — variant(v0.8.10) 분리 유지
- `% 매치` 폴백, PRICE DEBUG 임시 로그 제거
- 성능 영향 없음

## v0.8.10 (2026-08-04) — [extension] 쿠팡 vendorItemId(딜) variant 분리

- **옵션/딜별 가격 분리**: `vendorItemId`를 variant로 추가 추출 — 같은 productId라도 vendorItemId(딜)마다 가격이 다른데 itemId만 추출해서 **옵션별 가격이 한 상품에 섞이던 문제** 해결 (오리온 황치즈칩쿠키 9,880/14,900/27,530 혼합 사례)
- 성능 영향 없음

## v0.8.9 (2026-08-04) — [extension] 품절 상품 캡처 완전 스킵 (잔존 가격 요소 제거)

- v0.8.8에서 품절 상품의 `.total-price[data-price]`도 잔존값(14,900)을 가질 수 있음이 확인됨 — **품절이면 total-price 포함 전부 무시하고 무조건 스킵** (price=null → 캡처 안 함, 오리온 황치즈칩 품절 14,900원 사례)
- 성능 영향 없음

## v0.8.8 (2026-08-04) — [extension] 쿠팡 품절 상품 가격 오탐 방지

- **품절 상품 캡처 제외**: 쿠팡 품절(품절/일시품절/재입고 알림) 상품은 판매가 요소(`total-price`)가 사라지는데 body에 잔존하는 이전 가격(14,900 등)이 폴백으로 잡히던 문제 — 품절이면 판매가 요소만 허용하고 `% 매치`/`body 첫 금액` 폴백 금지 (오리온 황치즈칩쿠키 품절 14,900원 오탐 사례)
- 성능 영향 없음

## v0.8.7 (2026-08-04) — [extension+server] 정가 오탐 제거 + 핫딜 노이즈 필터

- **네이버 브랜드 정가(원가) 진동 수정**: `del/s/취소선/deal-before/원가` 요소를 DOM clone에서 제거 후 "상품 가격" 라벨 금액 추출 — 판매가(9,000)와 정가(40,000)가 함께 렌더되어 번갈아 캡처되던 문제 해결 (에스쁘아 77.5% 하락 오탐 사례)
- **쿠팡 정가 오탐 수정**: data-price 추출을 판매가 전용(`.total-price[data-price]`)으로 한정 — 정가(21,600)도 data-price를 가져 일반 `[data-price]` 폴백이 정가를 잡던 문제 해결 (엑씨 사생활 필름 사례)
- **핫딜 노이즈 필터**: drop 5% 미만(아이패드 0.1%/0.0% 등 소폭 변동) 상품을 핫딜에서 제외 (server)
- 오염 포인트 정리: 에스쁘아 40,000원 4건, 엑씨 21,600원 2건 삭제
- 성능 영향 없음

## v0.8.6 (2026-08-03) — [extension] 찜 배지 클리핑 수정 (viewport 고정 오버레이)

- **배지가 반 잘리던 문제 수정**: 카드 내부 absolute → **viewport 고정(fixed) 오버레이**로 전환 — 이미지가 컨테이너 위로 삐져나오거나 overflow:hidden인 카드 구조에서도 잘리지 않음
- 스크롤/리사이즈 시 배지 위치 재계산, 숨김 카드(lazy)는 display:none

## v0.8.5 (2026-08-03) — [extension] 목록/검색 페이지 찜 상품 배지

- **찜 상품 배지**: 검색/목록 화면에서 내 찜 상품 카드 우상단에 `★ 찜 N원` 오버레이 (서버 찜 목록과 대조, 카드 클릭 방해 없음 — pointer-events:none)
- **찜 목록 캐시**: background에 30초 TTL 캐시 + `WATCHES_GET`/`WATCHES_INVALIDATE` 메시지 — 팝업/플로팅에서 찜 추가·해제 시 캐시 즉시 무효화
- 배지 적용 시점: 페이지 로드 직후 + 스크롤로 새 카드 로드 시 (이미 배지된 카드는 스킵)
- 성능 영향: 페이지당 1회 WATCHES_GET (30초 TTL), 배지 DOM 삽입은 찜 상품만

## v0.8.4 (2026-08-03) — [extension] 카드 상품명 잡음 문구 필터

- **"새 창에서 열림" 등 UI 문구 오매치 방지**: 네이버 쇼핑 카드에서 a 태그/alt의 잡음 문구가 상품명으로 저장되던 문제 — 정확 일치 문구 목록으로 필터 (img alt 폴백에도 적용)
- 성능 영향 없음

## v0.8.3 (2026-08-03) — [extension] 네이버 쇼핑 상점명 오매치 최종 수정

- **이름 후보 중 최장 텍스트 선택**: 네이버 쇼핑 검색 `store:main:` 카드는 스토어명 요소가 상품명보다 먼저 매치되어 상점명("PC PRO" 등)이 이름으로 저장되던 문제 — 상품명이 항상 가장 긴 점을 이용
- `@스토어명 ` 접두사 제거 (네이버 상점 이미지 alt 패턴)
- v0.8.2의 a[href] 내부 우선은 `store:main:` 카드 구조에선 효과가 없어 최장 텍스트 방식으로 교체
- 기존 오염 이름은 브라우저 세션 재시작 후 재검색 시 서버 upsert로 갱신

## v0.8.2 (2026-08-03) — [extension] 네이버 쇼핑 검색 카드 상품명 추출 수정

- **스토어명 오매치 수정**: 네이버 쇼핑 검색 카드에서 상점 이름("샤인디지탈" 등)이 상품명으로 저장되던 문제 — 상품 링크(`a[href]`) 내부의 이름 요소를 우선 사용
- 이미 잘못 저장된 이름은 다음 캡처 시 서버 upsert로 자동 갱신
- 성능 영향 없음

## v0.8.1 (2026-08-03) — [extension] 카드 가격 추출 할부 문구 오매치 수정

- **"월 N원" 할부 문구 오매치 방지**: 쿠팡 검색 카드의 "월 28,418원"(무이자 할부)이 상품 가격보다 먼저 매치되던 문제 — `firstCardPrice()` 헬퍼로 통합 (월/개월 문구 제외, 올리브영 카드에도 적용)
- 원격 오탐 포인트 정리: Z Fold8 28,418원 삭제 (min 958,800 정상화)
- 성능 영향 없음

## v0.8.0 (2026-08-03) — [extension] Phase 2: 목록/검색 페이지 캡처

- **MallParser.detectMall 추가**: 상품 페이지가 아니어도 몰 판별 (`kind: product|listing`) — 쿠팡 검색(`/np/search`), 네이버 쇼핑 검색, 스마트스토어/브랜드 카테고리, 올리브영 카테고리/기획전
- **목록/검색 페이지 카드 수집**: 상품 페이지에서만 동작하던 연관 카드 수집을 검색/목록 페이지로 확장 (초기 1회 + 스크롤 시) — 기존 파이프라인(품목 등록 + 가격 포인트) 재사용, 1회 40개 상한 유지
- **쿨다운 정규화**: 목록 페이지는 pathname 기준 10분 쿨다운 (검색어/정렬 변경에 따른 폭주 방지)
- `store:`/`brand:` productID 접두사 규약 유지 확인
- [E-EXT-URL-2001] 목록 페이지 지원 (더 이상 상품 페이지만 요구하지 않음) / 성능 영향: 페이지당 40개 상한 + 쿨다운으로 제한

## v0.7.7 (2026-08-03) — [extension/server] 쿠팡 가격 추출 안정화 + 이상값 정리 API

- **쿠팡 가격 추출 개선**: `data-price` 속성 우선 (쿠팡이 실제 판매가에 부여하는 표준 속성) — 정가/쿠폰가/사전구매 할인가가 여럿 노출되어 첫 `%` 매치가 **번갈아 캡처되던 진동 문제** 해결 (Z Fold8: 2,841,800↔958,800 / 밴드톡: 22,440↔20,190)
- **관리용 포인트 삭제 API**: `DELETE /api/v1/products/{product_id}/prices/{price}` — 이상값(오탐 가격) 일괄 정리
- [E-EXT-NET-1001] 영향 없음 / 성능 영향 없음

## v0.7.6 (2026-08-03) — [extension] 팝업 재편 + 플로팅에 핫딜·알림 추가

- **팝업 재구성**: 순서 변경 — [현재 상품 찜] → [오늘의 핫딜] → [찜 목록]
- **알림 내역은 팝업에서 제거** → 플로팅 패널로 이동
- **팝업 찜 목록 접이식**: 헤더 ▾/▸ 토글로 접고 펼치기
- **플로팅 패널 신규 탭**: 오늘의 핫딜 (1/7/30일 토글, top 5, ▼% 배지) + 알림 내역 (메뉴에 개수 뱃지 표시)
- 플로팅 메뉴 순서: 가격 추이 → 오늘의 핫딜 → 찜 목록 → 알림 → 설정 → 사용법

## v0.7.5 (2026-08-03) — [extension] 플로팅 찜 목록도 개수 + 몰 필터

- 플로팅 패널(상품 페이지) 찜 목록 헤더에 개수 `찜 목록 (N)` + 전체/네이버/쿠팡/올리브영 픽커 (로컬 필터, 팝업과 동일)
- 로딩/오류/빈 상태 표시를 팝업과 동일 패턴으로 통일

## v0.7.4 (2026-08-03) — [extension] 찜 목록 개수 + 몰 필터 픽커

- **찜 목록 개수**: 헤더에 `찜 목록 (N)` 표시
- **몰 필터**: 전체 / 네이버 / 쿠팡 / 올리브영 픽커 버튼 — 로컬 필터(캐시 재렌더, 추가 요청 없음), 필터 결과 없으면 "이 몰에서 찜한 상품이 없습니다" 안내
- **팝업 레이아웃 정리**: 메인 스크롤 제거(고정 600px) → 찜 목록 영역만 내부 스크롤, 알림 목록도 넘침 대비 내부 스크롤(132px)
- **버그 수정**: 찜 목록 렌더 전 초기화 누락으로 '불러오는 중' 행이 목록 위에 남아있던 문제 수정

## v0.7.3 (2026-08-03) — [server] [extension] 핫딜 쿼리 최적화 + 팝업 UX 개선

- **서버 성능**: `/recommendations` N+1 제거 — 상품별 개별 조회(Neon에서 59초) → ROW_NUMBER+LAG 윈도우 함수 단일 쿼리 (0.8초)
  - 복합 인덱스 `price_points(product_id, captured_at)` — 시작 시 IF NOT EXISTS 생성 (기존 테이블 대응)
- **팝업 UX**:
  - 헤더(똑바 타이틀) **sticky 고정** — 스크롤해도 항상 최상단 유지
  - 섹션별 **로딩 인디케이터(스피너)**: 알림 / 오늘의 핫딜 / 현재 상품 통계 / 찜 목록 — 섹션은 처음부터 표시되고 내용만 교체, 실패 시 오류 문구 표시
  - 찜 목록 로딩 행 좌우 여백 14px 정렬 (기존 8px)
- **플로팅 패널**: 가격 추이 차트 자리에 '가격 이력 불러오는 중…' 스피너 표시 (서버 조회 동안)

## v0.7.2 (2026-08-03) — [server] [extension] 오늘의 핫딜 탭 (T-58 확장)

- **서버**: `/recommendations`에 `drop_percent`(할인율%) 추가 — 정렬 기준을 하락액 → **할인율% 큰 순**으로 변경 (기간: 1/7/30일 지원)
- **팝업**: '오늘의 핫딜' 섹션 추가 (기존 상품 위) — 기간 토글(1일/7일/30일), 하락폭 큰 상품 top 5
  - 카드: 썸네일 + 몰 배지 + 상품명 + 현재가 + 취소선 이전가 + ▼% 빨간 배지, 클릭 시 상품 페이지 오픈
- 로컬 검증: `/recommendations` 54.2% → 46.2% → 44.5% 순 정렬 확인

## v0.7.1 (2026-08-03) — [extension] Render 콜드스타트 대응 (공용 API 모듈)

- **문제**: Render 무료 티어는 15분 무요청 시 스핀다운 — 다음 요청이 30~60초 걸려 팝업/찜/가격 추이에서 `E-EXT-NET-1001` 발생 (브라우저가 켜진 동안엔 5분 폴링이 서버를 유지하므로 1~2초 지연은 정상)
- **공용 API 모듈**: `common.js`에 `SWB_API(path, options)` 추가 — fetch 타임아웃 45초(AbortController) + GET 전용 콜드스타트 재시도 2회(3초 간격) + 404 특수 처리 (`NOT_FOUND` 에러 유지)
- **중복 제거**: popup.js / background.js / swb-ui.js의 개별 `api()`/직접 fetch 전부 `SWB_API`로 통합 (직접 fetch 0건)
- **로딩 UX**: 팝업 초기화 중 "불러오는 중…" 표시 (찜 목록 로딩은 기존 유지)
- 버전 0.7.1 — Chrome에서 확장 리로드 필요

## v0.7.0 (2026-08-03) — [server] [extension] 클라우드 전환 (Render + Neon)

- **서버 이전**: 로컬 uvicorn(SQLite) → **Render 무료 웹서비스 + Neon 무료 Postgres 18**
  - 확장을 설치한 모든 사용자가 접속 가능한 공개 서버 (`https://shop-wisebar.onrender.com`)
  - PostgreSQL 전환: `database.py`에서 SQLite 전용 인자(`check_same_thread`) 조건부 처리, `psycopg[binary]`(psycopg3) 추가
  - `DATABASE_URL` 환경변수로 전환 (로컬 개발은 SQLite 유지, Render만 Postgres)
  - 검증: 로컬+원격에서 기기→상품→가격→찜→하락 알림 전체 시나리오 통과 (PostgreSQL 18.4)
- **확장**: `common.js` 서버 주소 → Render URL, `manifest.json` host_permissions + 버전 0.7.0
- 로컬 실측 DB(shopwisebar.db)는 개발용으로 유지 — 프로덕션 데이터는 Neon에서 새로 시작

## v0.6.2 (2026-08-03) — [extension] 연관 카드 정가 오탐 수정 + 플로팅 패널 위치 보정

- **버그**: 연관 상품 카드에서 텍스트의 첫 번째 금액을 가격으로 추출 — 네이버/쿠팡 카드는 취소선 정가(159,990원)가 판매가(114,900원)보다 먼저 나와, 연관 수집 가격이 정가로 저장되고 실제 방문 캡처와 비교 시 "가격 하락" 오탐 알림 발생
- **수정**: 카드 clone에서 `s/del/strike/line-through`(취소선 정가) 요소 제거 후 가격 추출
- **실측 정리**: 에어로클립 159,990원 오탐 이력/통계/알림 기록 삭제 (실가 114,900원만 유지)
- **플로팅 패널 위치 보정**: 기본 위치(플로팅 버튼 왼쪽 중앙 75vh) 유지하되, 브라우저 하단을 넘으면 위로 이동 — `positionPanel()` + ResizeObserver(데이터 로드 후 높이 변화 대응) + 리사이즈 리스너
- **팝업 스크롤**: 팝업 높이 600px 고정 + 내부 스크롤 (브라우저 창이 작을 때 하단 잘림 방지)
- **아이콘 교체**: 쇼핑박스+가격 그래프 합친 모양 (scripts/generate_icon.py 생성기 — /tmp 스크립트 프로젝트로 이관)

## v0.6.1 (2026-08-03) — [server] 알림 감지 버그 수정 (T-66 검증)

- **버그**: `GET /alerts?since=` 폴링에서 직전 가격을 "since **이전** 캡처"로만 찾음 — 찜 이후 첫 하락(모든 캡처가 since 이후)이면 `previous=None` → 하락 미감지
- **수정**: since는 '신규 보고 캡처' 필터로만 사용, 직전 가격은 since 이전이어도 비교 기준으로 채택 (전체 이력 variant별 그룹핑 통합)
- **부수 수정**: since(datetime aware) vs captured_at(naive) 타입 불일치 에러 방지 (`replace(tzinfo=None)`)
- **T-66 알림 실기기 테스트 완료** (크롬+웨일): 찜 → 가격 하락 시뮬레이션 → 5분 내 알림(-25%/-16%), 알림 클릭 → 상품 페이지 오픈, 팝업 알림 내역 기록 확인
- 테스트용 시뮬레이션 가격 3건 삭제 + 일별 통계 재집계

## v0.6.0 (2026-08-03) — [server] 가격 로우데이터 dedup + 일별 통계

- **가격 기록 구조 변경**: 가격이 **변할 때만** `price_points`에 INSERT (같은 가격 재방문은 로우 생성 없음)
  - 문제: 방문마다 로우가 쌓여 같은 가격이 중복 기록 — 가격 추이/차트 왜곡
- **신규 `price_daily_stats` 테이블**: 일별 1행 — `open_price/close_price/low_price/high_price/point_count` (UNIQUE(product_id, stat_date))
  - 방문은 전부 통계로 집계: 기존 178행이 89행으로 dedup, stats 78행 자동 생성
- **race 방어**: `captured_at` 초 단위 절단 + UNIQUE 위반 시 IntegrityError catch (동시 POST/이벤트 중복 호출에도 중복 INSERT 차단)
- **실기기 실측**: 해피바스 재방문 (같은 5,990원) → price_points 2행 유지 + point_count 3→5 증가 / 리멤버린 가격 변동 4,980→24,900 → 신규 로우 정상 캡처

## v0.5.0 (2026-08-03) — [extension] 연관 상품 자동 수집 (Phase 1)

- **상품 페이지 연관 상품 캡처**: 상품 페이지에서 "함께 비교하면 좋을 상품/비슷한 상품/이런 상품은 어때요" 등 연관 섹션의 상품 카드를 자동 수집해 카탈로그에 등록
  - 범용 추출기(`Extractor.extractRelated`): 특정 섹션명에 의존하지 않고 상품 링크 + 카드(이미지/이름/가격) 기반 — 몰 구조 변경에 견고
  - 가격이 노출되는 상품은 가격까지 저장 (`source=extension`), 가격 없는 상품은 카탈로그만 등록 (방문 시 가격 캡처)
  - **수집 시점 2단계**: ①페이지 로드 직후 1회 (현재 보이는 카드) ②사용자가 스크롤할 때 lazy 로딩으로 새로 로드된 카드만 재수집 (600ms 디바운스) — 자동 스크롤 금지
  - 중복 방지: content(relatedSentIds) + background(relatedUploadedIds) 이중 안전망, 1회 최대 10개
  - Phase 2(목록/검색 페이지), Phase 3(관계 그래프)는 예정

## v0.4.0 (2026-08-03) — [server] [extension] 가격 통계·추적자 수·방문 유도

- **서버 가격 통계 API 확장**: `GET /products/{id}` 응답에 `min_price`/`avg_price`/`price_count`/`watch_count` 추가 (전체 기록 기준 집계)
  - `watch_count` = 해당 상품을 추적 중인 기기 수 — "N명 추적" 지표
  - `GET /devices/{did}/watches` 응답에 `last_checked_at` 추가 (마지막 캡처 시각)
- **팝업 UI**: 현재 상품 섹션에 '역대 최저가'/'평균보다 저렴' 배지 + 평균·최저가·추적자 수 표시
- **플로팅 패널**: 가격 추이 패널에 동일 배지 추가 (서버 전체 통계 기준, 기간 필터와 별개)
- **브라우저 알림 강조**: 가격 하락 시 `가격 N% 내려갔습니다!` 타이틀 + `-N%` 할인율 표기
- **재방문 유도 (방문 캡처)**: 찜 목록(팝업/플로팅)에 3일 이상 미캡처 상품에 `확인 필요 · N일 전` 배지 — 클릭 시 상품 페이지 오픈 → 자동 캡처로 최신 가격 수집

## v0.3.1 (2026-08-03) — [extension] [server]

- **상품 페이지 플로팅 버튼 + 가격 추이 패널**: 상품 페이지 우하단 플로팅 버튼(하락 그래프 아이콘) → 클릭 시 해당 상품의 가격 추이 표시 (shadow DOM으로 페이지 스타일 격리)
  - 상품명 / 최근가 / 직전 대비 변동(▼▲) / 최저·최고가 / 이력 건수 / 캔버스 라인 그래프
  - 서버에서 실시간 조회 (`GET /products/{id}` + `/prices?limit=50`), 서버 다운 시 에러 안내 (E-EXT-NET-1001)
  - SPA 라우팅 대비 URL 변경 감시(2초 주기 location 비교)
- **공용 설정 통합**: `common.js`에 `SWB_CONFIG`(서버 주소 단일화) — background/popup/content 공유
- 기기ID 중복 발급 수정 + `init()` 중복 호출 제거 (기기 1개 고정 확인)

## v0.3.0 (2026-08-03) — [server] [extension] 전면 재구성

- **아키텍처 전환**: 맥 메뉴바 앱 폐기 → 중앙 서버 + 브라우저 익스텐션(Chrome MV3)
  - 맥 앱 코드 전체 제거 (git 히스토리로만 보존)
  - 수집 우선순위: ①서버 크롤러(올리브영 Playwright) ②익스텐션(전 몰) ③(폐기) 맥 메뉴바
- **결정 기록**: 크롤링 PoC 실측 결과 반영
  - 올리브영 서버 Playwright headless 성공 (403 우회, 가격+og 메타)
  - 네이버: 쿠키 없는 브라우저 전부 캡차 차단 / 쿠팡: Akamai Access Denied
  - → 네이버/쿠팡은 익스텐션이 유일한 자동 수집 채널
- docs 전면 재작성 (PRD/DESIGN/PLAN/TODO)

## v0.2.x (2026-08-02 ~ 08-03) — [macos] 레거시 (폐기)

- T-59 가격 변동 알림 3중 구조, 개발자 서명, 토스트 등 — v0.3.0에서 전면 폐기
