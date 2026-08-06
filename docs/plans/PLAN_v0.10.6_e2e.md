# PLAN v0.10.6 — 확장 E2E 자동화 (T-98)

> 날짜: 2026-08-06 | 플랫폼: chrome+server (extension + server) | 상태: 진행중
> 세션: chrome-devtools-mcp 설치 완료 후, 기존 자동화 공백(E2E 없음)을 메우기 위한 작업

## 1. 개요

현재 자동화 현황:
- ✅ 서버 단위 테스트: `server/tests/` pytest (34건)
- ✅ 스토어 스크린샷 캡처: `scripts/store-capture/capture.js` (데모 주입→캡처→정리)
- ✅ 스토어 배포/시크릿: `webstore-publish.sh`, `env-expiry-check.sh`
- ❌ **확장 E2E 자동화 없음** — 팝업/콘텐츠 스크립트/서버 왕복을 실제 브라우저로 검증하는 스크립트 부재

목표: **로컬 서버 격리 + 실제 Whale 브라우저 + 실제 확장**으로 전체 파이프라인
(가격 추출 → 서버 저장 → 팝업 표시)을 한 번에 자동 검증하는 E2E를 만든다.

## 2. 결정 사항

| 항목 | 결정 | 이유 |
|------|------|------|
| 서버 | **로컬 uvicorn 기동** (임시 DB, 격리) | Render 운영 DB 오염 방지 + 네트워크 의존 제거 |
| 브라우저 | **Whale 실제 창** (headless=false) | 심사/실사용과 동일 렌더링, 확장 로드 가능 |
| 확장 서버 주소 | E2E 전용 복사본에서 `common.js`의 `SWB_CONFIG.server` 치환 | 실서버(`common.js` 원본) 훼손 없이 로컬 지향 |
| 확장 프로필 | `--userDataDir` 기존 `.whale-profile` 재사용 | 네이버 봇 감지 우회 (capture.js에서 검증됨) |
| 검증 상품 | 올리브영 상세 페이지 (기본) | 봇 차단 없음. 네이버는 자동화 접속 시 429 차단됨 (실측) |
| 실패 처리 | 실패 시 exit 1 + 로그, 데모 데이터 무조건 정리 | CI 연동 대비 |

## 3. 아키텍처

```
scripts/e2e/
├── run-e2e.sh          # 진입점: 서버 기동 → E2E → 서버 종료 (트랩으로 정리 보장)
├── e2e.js              # Playwright E2E 본체
│                        #  1) 확장 복사본 생성 (common.js 서버 주소 → 로컬)
│                        #  2) 데모 데이터 주입 (핫딜 5개 + 현재 상품 이력 3개)
│                        #  3) Whale + 확장 로드 (persistent context)
│                        #  4) 상품 페이지 방문 → 가격 추출 → 서버 저장 대기
│                        #  5) 팝업 열기 → 렌더링 검증 (가격/통계/배지/핫딜)
│                        #  6) 서버 API 재조회로 저장 확인 (price_points)
│                        #  7) 데모 데이터 자동 정리 + 결과 리포트
├── package.json        # playwright-core (store-capture와 동일 버전)
└── README.md           # 실행법
```

### 검증 시나리오 (TC)

| TC | 검증 내용 | 판정 기준 |
|----|-----------|-----------|
| TC-E2E-001 | 서버 /health | status=ok |
| TC-E2E-002 | 상품 페이지 가격 추출 | JSON-LD price > 0 (기준: 실제 판매가) |
| TC-E2E-003 | 서버 저장 | GET /products/{id} → last_price 일치 + price_points ≥ 1 |
| TC-E2E-004 | 팝업 현재 상품 표시 | currentName/currentPrice/currentStats 비어있지 않음 |
| TC-E2E-005 | 핫딜 탭 표시 | 데모 5개 렌더링 |
| TC-E2E-006 | 데모 정리 | DELETE 후 GET 404 |

## 4. 구현 단계 (T-번호)

- [x] **T-98a**: `scripts/e2e/package.json` + playwright-core 설치
- [x] **T-98b**: `e2e.js` — 확장 복사본 생성 + 데모 주입 + 브라우저 E2E + 검증
- [x] **T-98c**: `run-e2e.sh` — 서버 기동/종료 + e2e.js 실행 + 정리 트랩
- [x] **T-98d**: 실검증 (전체 플로우 통과 확인) + 문서 갱신

## 5. 테스트 계획

- 실행: `./scripts/e2e/run-e2e.sh`
- 로컬 서버 포트: 8765 (8000은 타 프로젝트 점유 — E2E 전용 포트)
- 검증 후 임시 DB/프로필/확장 복사본 자동 정리
- 실패 시에도 데모 데이터 삭제 보장 (try/finally + shell trap)
- **검증 결과**: 연속 3회 10/10 통과 (TC-E2E-001~006 전부)

### 몰별 이슈 (실측)

| 몰 | 결과 |
|----|------|
| 올리브영 | ✅ 봇 차단 없음 — 기본 상품으로 사용 |
| 네이버 스마트스토어 | ⚠️ 자동화 브라우저 접속 시 **HTTP 429** (봇 차단) — 일정 시간 후 재시도 필요 |
| 쿠팡 | ⚠️ 403/봇 차단 이슈 (기존 확인 사항) |

## 6. 롤백 계획

- git revert (E2E 스크립트만 추가 — 코드/DB 변경 없음)
- 데모 데이터 수동 정리: `node scripts/store-capture/cleanup.js`

## 7. 성능 예산

- E2E 전체 런타임 ≤ 90s (콜드 스타트 + 네이버 로드 + 팝업 렌더)
- 스크린샷 저장 없음 (텍스트 검증) — a11y 덤프(.a11y.txt)로 대체

## 8. 에러코드

| 코드 | 메시지 |
|------|--------|
| E-E2E-SRV-1001 | 서버 기동 실패 / /health 응답 없음 |
| E-E2E-EXT-1002 | 확장 ID를 찾지 못함 |
| E-E2E-EXT-1003 | 상품 가격 추출 실패 (JSON-LD 없음) |
| E-E2E-DB-1004 | 서버 저장 검증 실패 (last_price/price_points 불일치) |
| E-E2E-UI-1005 | 팝업 렌더링 검증 실패 |
| E-E2E-UI-1006 | 핫딜 렌더링 검증 실패 |
