# 똑바(Shop WiseBar) 프로젝트 종료 아카이브

> 상태: **종료(Archived) — 2026-08-15**
> 이 문서는 이후 타 프로젝트에서 이 저장소의 소스/문서를 재사용할 수 있도록
> 시스템 구성, 기술 스택, 실행 방법, 운영 인프라, 실측 교훈을 최종 기록한다.
> 개별 문서(`docs/PRD.md`, `docs/DESIGN.md`, `docs/CHANGELOG.md`, `docs/plans/*`)는 그대로 보존.

---

## 1. 프로젝트 개요 · 최종 상태

- **제품명**: 똑바 (Shop WiseBar)
- **핵심 가치**: 쇼핑몰 상품 가격을 자동 추적해 "지금 사도 되는 가격" 알림
- **최종 버전**: 익스텐션 v0.16.11 / 서버 v0.16.16 / 매니저 v0.16.19 (브랜치 `main`, 커밋 `5a264ab`까지)
- **실사용 규모** (2026-08-15 기준): 기기 84대, 상품 7,641개(쿠팡 4,274 / 네이버 3,249 / 올리브영 118), 찜 17건, 가격 포인트 7,523건, 알림 5건, 크롤러 실행 159회. 서비스 시작 2026-08-03.
- **배포**: Render 웹 서비스(`shop-wisebar`) + 로컬 macOS 크롤러 (공식 API는 미도입)

## 2. 종료 사유

1. **타사 스크래핑의 구조적 취약성** — 쿠팡은 Akamai 차단, 네이버는 캡차·IP 플래그(슬로우 다운), 올리브영은 WAF 403. 서버 자동 수집은 쿠팡·네이버에서 원천 불가(실측 확정), 유지보수는 계속되는 차단·구조 변경과의 전쟁.
2. **가격 정확성 미확보 → 핵심 가치 훼손** — "가격 하락/핫딜" 기능의 가치는 정확한 가격에서 나오는데, HTML 파싱이 정가·적립·혜택·옵션가를 판매가로 오인하는 오탐이 반복(예: 핫딜 "▼86%" 왜곡). 오탐 1건이 `last_price/min/avg/prev`를 영구 오염시켜 사용자 신뢰를 깎음.
3. **수고 대비 가치 하락 판단** — 크롤러 차단 회피 + 가격 검증 계층을 계속 고쳐도 근본 취약성은 남는 구조. 개인 프로젝트 유지보수 비용이 지속 가치보다 커짐.

> 종료 직전 최종 조사 결과(2026-08-15): 네이버 가격 파싱 오탐의 근본 원인은
> "가격 검증 계층 부재 + 파서가 body 첫 `N원`에 의존" — 이 교훈은 8장에 상세 기록.

## 3. 시스템 구성 (5개 컴포넌트)

```
┌────────────────────────────────────────────────────────────────┐
│ 브라우저 익스텐션 extension/ (Chrome MV3, v0.16.11)             │
│  background.js   — 서비스 워커: 수집 스케줄/캡처 업로드/알림 폴링 │
│  content.js      — DOM/JSON-LD에서 상품 메타 추출(몰별 파서)      │
│  popup/          — 현재 상품·찜·가격 추이·전체 핫딜·연관 상품      │
│  options/        — 설정, onboarding/ — 첫 실행 가이드             │
└───────────┬────────────────────────────────────────────────────┘
            │ HTTPS (/api/v1)
┌───────────▼────────────────────────────────────────────────────┐
│ 중앙 서버 server/ (FastAPI + SQLAlchemy, v0.16.16)              │
│  app/main.py         — FastAPI 앱 + 라우터 등록                 │
│  app/models.py       — products/price_points/watches/devices 등 │
│  app/routers/        — products, watches, devices, relations,   │
│                        recommendations(핫딜), admin(매니저),     │
│                        stats(통계)                              │
│  crawlers/           — worker(배치) + naver.py + oliveyoung.py  │
│                        + targets.py(목록 크롤) + _browser.py     │
│  tests/              — pytest (전체 ~92건 + stats 5건)           │
└───────────┬────────────────────────────────────────────────────┘
            │ 운영
┌───────────▼────────────────────────────────────────────────────┐
│ 운영 인프라                                                     │
│  Render (web) — Neon PostgreSQL(선택, 없으면 SQLite 폴백)        │
│  로컬 macOS 크롤러 — scripts/run-local-crawler.sh + plist        │
│  (또는 Render worker, render.yaml에 정의, 중복 구동 금지)        │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ 관리자 앱 macos/ (SwiftUI, v0.16.19, XcodeGen)                  │
│  매니저: 개요/상태/상품/크롤러/통계/설정 탭 + 디버그 패널(Cmd+Shift+D) │
│  로컬 배치 실행기(크롤러 워커 Process 직접 제어) + 서버 오버라이드  │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ 랜딩 페이지 landing/ (GitHub Pages: borasarang.github.io/Shop-WiseBar) │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ 검증 프로젝트 ShopWiseBar-Verify/ (별도 저장소, 2026-08-09)      │
│  3몰 × 엔진(로컬 Chrome/Browserless) 크롤링 가능성 실측 매트릭스  │
│  → 올리브영 ✅ / 네이버 캡차 ❌ / 쿠팡 Akamai ❌ 확정             │
└────────────────────────────────────────────────────────────────┘
```

## 4. 기술 스택

| 영역 | 스택 |
|------|------|
| 익스텐션 | Chrome MV3 (Vanilla JS, 서비스 워커), WebExtension 표준 |
| 서버 | Python 3 + FastAPI + SQLAlchemy + Uvicorn, SQLite(로컬)/Neon PostgreSQL(운영) |
| 크롤러 | Playwright(Python), 네이버 순차(1)·올리브영 병렬(3) — 실측으로 결정 |
| 관리자 앱 | macOS SwiftUI (iOS 14.0+), XcodeGen, @Observable/@MainActor, Swift 6 |
| 운영 | Render Blueprint (Docker), GitHub Pages 랜딩 |
| 문서 | docs/ 통합 (PRD/DESIGN/PLAN/TODO/CHANGELOG + plans/ 세부) |
| 이슈/지식 | bd(beads, `.beads/` Dolt DB), 세션 로그 `.agent/session-*.md` |

## 5. 저장소 구조 · 재사용 포인트

| 경로 | 내용 | 재사용 가치 |
|------|------|------------|
| `server/app/routers/*` | REST API 8개 라우터 | ★★★ FastAPI 라우터 구조/패턴 (N+1 방지, 에러코드 매핑) |
| `server/app/models.py` | SQLAlchemy 모델 + `_ensure_columns` 마이그레이션 | ★★★ SQLite→PG 호환 스키마 마이그레이션 패턴 |
| `server/crawlers/worker.py` | 배치 워커 (스케줄/병렬/상태 기록) | ★★ Playwright 배치 설계 + 실측 병렬 수치 |
| `server/app/routers/recommendations.py` | 핫딜 쿼리 (하락/최저가, KST) | ★★ 윈도 함수 기반 시계열 하락 감지 SQL |
| `extension/content.js` | 몰별 상품 메타 파서 (JSON-LD 우선) | ★★ JSON-LD/HTML 폴백 파싱 규약 |
| `macos/ShopWiseBarManager/core/` | DebugLogger + DebugPanel | ★★ macOS 앱 디버그 로그 패널 (Cmd+Shift+D) |
| `macos/project.yml` | XcodeGen 설정 | ★★ 폴더 기반 자동 프로젝트 생성 |
| `docs/plans/PLAN_v*.md` | 버전별 구현 계획 (문서 우선 원칙) | ★★★ 작업 프로세스 템플릿 |
| `scripts/e2e/`, `scripts/webstore-publish.sh` | E2E/스토어 자동화 | ★ 배포 파이프라인 참고 |
| `render.yaml`, `server/Dockerfile` | Render 배포 정의 | ★★ Playwright 빌드(root apt) 주의사항 포함 |
| `error_message_ko.json` | 에러코드→사용자 메시지 매핑 | ★★ 에러코드 체계 (E-PLATFORM-CAT-NNNN) |

## 6. 실행 방법 (재시작 시)

```bash
# 서버 (SQLite 로컬)
cd server
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000          # API + Swagger /docs
.venv/bin/python -m crawlers.worker       # 크롤러 워커 (별도 프로세스)

# 매니저 (macOS)
cd macos && xcodegen generate              # 새 파일 추가 시 필수
xcodebuild -project ShopWiseBarManager.xcodeproj \
  -scheme ShopWiseBarManager -configuration Debug build

# 익스텐션 (Chrome)
# chrome://extensions → 개발자 모드 → "압축해제된 확장 프로그램 로드" → extension/

# 랜딩 (GitHub Pages)
# main 푸시 시 자동 배포 (borasarang.github.io/Shop-WiseBar)

# 테스트
cd server && .venv/bin/python -m pytest tests/test_stats.py   # 단위만 빠르게
# (전체 pytest는 브라우저 테스트 포함으로 2분+ — 대상 지정 실행 권장)
```

## 7. 운영 인프라 (정리 전 필수 확인)

| 항목 | 상태 | 정리 시 |
|------|------|---------|
| Render `shop-wisebar` (free) | 운영 중 | 해지 시 DB(Neon) 마이그레이션/백업 선행 |
| Neon PostgreSQL | DATABASE_URL로 연결 | 백업 후 삭제 또는 비용 발생 시 정리 |
| Browserless 클라우드 | 크롤러 검증용 | 미사용 중 (로컬 Chrome 사용) |
| 웨일 스토어 등록 (v0.16.11) | 등록됨 | 스토어 리스팅 정리 시 `docs/store/` 참고 |
| GitHub Pages 랜딩 | 배포됨 | 유지/제거 결정 |

- **데이터 백업**: 로컬 `server/shopwisebar.db`(SQLite)를 보관용으로 복사해 둘 것. 운영은 Neon.
- **시크릿**: `.env`(로컬) + Render 환경변수(운영). `scripts/env-expiry-check.sh`가 만료 체크.

## 8. 실측 교훈 (재사용 가치 최상위)

### 8.1 쇼핑몰 스크래핑 가능성 (2026-08-03 ~ 08-14 실측 확정)
| 몰 | 헤드리스 서버 | 사용자 브라우저 확장 |
|----|--------------|---------------------|
| 올리브영 | ✅ (병렬 3, WAF는 확장 UA로 통과) | ✅ |
| 네이버 | ⚠️ 캡차/캐릭터 검증, IP 플래그 → 슬로우 다운, body 100자대 실패 | ✅ (로그인 세션) |
| 쿠팡 | ❌ Akamai (HTTP 403) | ✅ |

- **핵심**: 서버 자동 수집은 쿠팡/네이버에서 원천 불가 → **익스텐션(사용자 자발적 캡처)이 유일한 자동 수집 채널**. 다중 사용자가 많을수록 데이터 누적.
- 네이버는 `networkidle` 대기 + 스크롤 재시도(최대 5회)로 가격 지연 렌더링 대응. 순차(1) 강제가 차단 완화에 가장 효과적.

### 8.2 가격 오탐의 근본 원인과 방어 설계 (핫딜 "▼86%" 왜곡 사례)
**근본 원인**: 시스템에 "수집된 가격이 실제 판매가인지 검증하는 계층"이 없었고, 파서가 HTML의 body 첫 `N원`에 의존.
- 쇼핑몰 페이지에는 판매가 외에 정가(할인 전 가격), 적립, 배송비, 혜택, 옵션가가 존재 → 어떤 숫자든 가격으로 잡힘.
- 네이버 실측 구조: `할인 전 가격 79,000원 → 상품 가격 49,000원` → body 첫 금액은 **정가(79,000)**.
- 오탐 1건이 `last_price`를 덮고 `min/avg/prev`를 영구 오염 → 핫딜·알림·통계 전부 왜곡.
- 하한(1,000원 미만)만 있던 저장 필터는 상한/급변/소스 신뢰도가 없어 57만원 스파이크가 통과.

**권장 방어 설계 (후속 프로젝트 적용 권장)**:
1. **파서 표준화** — "판매가" 정의를 몰별로 통일: JSON-LD `offers.price` + `상품 가격` 라벨 우선, **body 첫 금액 폴백 제거**.
2. **서버 저장 검증 계층** — `하한 + 상한 + 기존 last_price 대비 ±80% 급변 보류 + 소스 신뢰도(크롤러 > 상품페이지 캡처 > 카드 캡처)`. 오탐은 `last_price`에 반영하지 않고 격리.
3. **canonical price** — `last_price`를 "마지막 수집값"이 아닌 "검증 통과한 최근 가격"으로 재정의.
4. **쿼리 검증** — 핫딜 `previous_price`도 검증해 비현실적 할인율 차단.
5. **데이터 정화** — 오탐 `price_points` 삭제 스크립트 (이 저장소에서 v0.16.17에 32건 수동 정리 경험).

> ※ 급변 방어의 한계: 실제 70%+ 세일(젤라 인텐션 39,000→11,500)도 오탐으로 오분류 가능.
> 임계값(±80%)은 "진짜 특가 놓침 vs 오탐 통과"의 트레이드오프 — 정확성 요구도에 따라 조정.

### 8.3 익스텐션 가격 캡처 규약 (content.js)
- **JSON-LD 우선**: `ld.offers.price`가 1,000~50,000,000 범위 내면 신뢰. `ld.mpn/productID`와 URL 상품번호 불일치 시 캡처 스킵(옵션 전환 레이스 방지).
- HTML 폴백은 `del/s/original-price`(정가)를 제거 후 "상품 가격" 라벨 뒤 금액.
- **쿠팡**: `.price-container` + "일반할인가" 섹션 마지막 금액이 구매가(실측). 품절이면 전부 불신.
- **올리브영**: `data-qa-name="text-product-discount-price"` → `em.tx_num` → body 폴백.

### 8.4 시계열 하락 감지 SQL (recommendations.py)
- 윈도 함수 `ROW_NUMBER/LEAD`로 variant별 최신가·직전가 대비 5%+ 하락, 그리고 기간 전 최저가 갱신(최저가)을 병합.
- **쿠팡은 variant 지정 포인트만 신뢰** (옵션 미지정 포인트가 하락 오탐 생성 — v0.8.20).
- 날짜 경계는 **KST** 기준, SQLite는 naive·PG는 tz-aware로 분기 처리.

### 8.5 작업 프로세스 (이 프로젝트가 잘했던 것)
- **문서 우선**: 코딩 전 `docs/plans/PLAN_v{버전}_{플랫폼}.md` + TODO 등록 + DESIGN 갱신 → 세션 단절에도 복구 가능.
- **실측 기반 결정**: 파싱/병렬/차단 판단을 전부 실제 브라우저 실측으로 확정 (검증 프로젝트 별도 분리).
- **에러코드 체계**: `E-PLATFORM-CATEGORY-NNNN` + `error_message_ko.json`으로 사용자 메시지 분리.
- **세션 로그**: `.agent/session-YYYY-MM-DD-*.md`로 매일 인수인계.
- **bd(beads)** 이슈 트래커: `.beads/`에 Dolt DB로 보존 (git remote와 별개).

## 9. 재시작/재사용 체크리스트

- [ ] `server/shopwisebar.db`(또는 Neon) 백업 확인
- [ ] `.env`(로컬) / Render 환경변수(운영) 값 확인
- [ ] `crawler_config.enabled=false` 상태면 `PUT /admin/crawler/config {enabled:true}`로 재개
- [ ] 크롤러 활성화는 **Render worker 또는 로컬 macOS 둘 중 하나만** (중복 구동 금지)
- [ ] `xcodegen generate` 후 매니저 빌드 (새 Swift 파일 추가 시 필수)
- [ ] 가격 검증 계층(8.2)을 새 프로젝트 초기 설계에 반영할 것 — 이 저장소의 최대 교훈
- [ ] 파서는 "body 첫 N원" 패턴을 쓰지 말 것 — JSON-LD/라벨 기반으로 설계

## 10. 참고 문서 목록

| 문서 | 내용 |
|------|------|
| `docs/PRD.md` | 제품 요구사항 (수집 우선순위, productID 규약, 사용자 스토리) |
| `docs/DESIGN.md` | 기술 설계 (아키텍처, DB 스키마, API 명세, 익스텐션 파서) |
| `docs/PLAN.md` · `docs/TODO.md` | 구현 로드맵 · 작업 추적 |
| `docs/CHANGELOG.md` | 버전별 변경 이력 (v0.3 ~ v0.16.19) |
| `docs/plans/PLAN_v*.md` | 버전별 상세 계획 (가격 오탐 방어, 확장 구조, 매니저 등) |
| `docs/store/`, `docs/chrome/`, `docs/api/` | 스토어 리스팅, 권한/메시징, API 명세 |
| `docs/tests/`, `docs/e2e/` | 테스트 기록 (크롤러 PoC 등) |
| `.agent/session-*.md` | 일별 세션 로그 (2026-08-03 ~ 종료일) |
| `.beads/` | bd 이슈 트래커 Dolt DB (이슈·노트 보존) |

---

*2026-08-15 종료 결정. 이 저장소는 읽기 전용 아카이브로 남기며, 필요 시 타 프로젝트의 참고 자료로 사용한다.*