# PLAN v0.16.0 — 네이버 서버 크롤러 추가 + 크롤러 제어 API

> 문서 우선 원칙: 검증 프로젝트(ShopWiseBar-Verify) 결과 → 운영 서버 반영 계획
> 작성: 2026-08-10 (v1 — 네이버 크롤러 / v2 — 크롤러 제어 API 확장) / 상태: 🔵 진행
> 버전: v0.16.0 (다음 릴리즈)

## 개요
후속 조치: ShopWiseBar-Verify 2차 검증(2026-08-10)에서 **네이버 브랜드스토어가 서버 Playwright(headless, Chrome UA)로 캡차 없이 이름+가격 수집 가능**함을 실측 확인.
기존 1차 PoC(docs/tests/v0.3_crawler_poc.md)는 네이버를 "캡차로 서버 크롤 불가 → 익스텐션 의존"으로 확정했으나, v0.16.0에서 아키텍처를 갱신한다.

## 결정 사항
1. **네이버 서버 크롤러 신규 채택** — `server/crawlers/naver.py`
   - 전략: `channel="chrome"` 헤드리스 + Chrome UA + `wait_until="networkidle"` + 가격 텍스트 대기 스크롤(최대 5회) + body `N원` 정규식
   - 이는 검증 프로젝트 `crawlers/naver.py`에서 3건 성공(69,990 / 69,990 / 249,000원), 캡차 0회 실측
2. **대상**: `brand.naver.com` (브랜드스토어). `smartstore.naver.com`은 구조 동일하나 별도 실측 후 단계적 확장.
3. **쿠팡**: 서버 크롤러 계속 불가 (Akamai Access Denied 확정) → 익스텐션 의존 유지 (PRD 2장)
4. **Browserless 클라우드**: 미채택 (클라우드 IP 차단 실측) → 서버는 로컬 시스템 Chrome 채널만 사용
5. `CRAWLABLE_MALLS` 정의 누락 버그 수정 (worker.py) — oliveyoung.py 80행 임포트 실패 잠재

## v2 — 크롤러 제어 API (작업 단계 확정, 2026-08-10)
> macOS 매니저(다음 단계)에서 사용할 서버측 제어/모니터링 API. 서버만 구현.
- **주기**: 기본 1시간, 허용 {1,3,6,12,24}시간. worker가 DB에서 읽어 **실시간 반영**.
- **동작 로그**: 배치 이력(시각·몰·성공/실패·건수·소요·트리거)만, 개별 상품 로그 없음.
- **운영 실행**: Render Start Command 통합 `uvicorn ... & python -m crawlers.worker` (번호2 — 서비스 추가 없음)

## 아키텍처
- `crawlers/naver.py`: `fetch(url) → {name, price, image} | None`, `run_once() → int` (oliveyoung 패턴 동일)
- `crawlers/worker.py`: `CRAWLABLE_MALLS = ("oliveyoung", "naver")` + 30초 틱 실시간 설정 읽기 + 배치 로그 기록
- `crawlers/oliveyoung.py`: run_once 자사 몰만 필터 (v1에서 수정)

## 구현 단계
- [x] **T-116a** `crawlers/naver.py` 신규 — 네이버 브랜드 상품 fetch + run_once
- [x] **T-116b** `crawlers/worker.py` — CRAWLABLE_MALLS 정의 + naver.run_once 포함 + 각 크롤러 자사 몰 필터
- [x] **T-116c** 로컬 실수집 검증 — 네이버 실상품 10건 가격 수집 + price_point 반영
- [x] **T-117a** `crawler_runs`/`crawler_config` 테이블 + 시드 (models.py, main.py startup)
- [x] **T-117b** `worker.py` 30초 틱 재작성 — 주기 실시간 반영 + run_requested 즉시 배치 + 배치 로그 기록 + `--once`
- [x] **T-117c** `admin.py` — `GET/PUT /admin/crawler/config` + `POST /admin/crawler/run` + `GET /admin/crawler/logs`
- [x] **T-117d** 로컬 실검증 — worker --once / PUT 주기 즉시 반영 / POST run 즉시 배치 / crawler_runs 반영 (올리브영 실수집 2건 + trigger=manual)
- [x] **T-117e** pytest — crawler config/logs 8건 + 회귀(총 74건) + CHANGELOG/ENDPOINTS + APP_VERSION=0.16.0

## 성능 예산
- 단건 수집: networkidle + 스크롤 대기로 최대 ~15s (oliveyoung 5s 대기보다 큼)
- 배치: 1회당 몰 2종 각 10개, 주기 기본 1시간 — 30초 틱은 기존 30분과 동일 부하 내

## 롤백 계획
- 네이버 크롤러 운영 실패 시: `CRAWLABLE_MALLS`에서 `naver` 제거(즉시). 기존 익스텐션 업로드 경로 무영향 (upsert 멱등).

## 관련 문서
- 검증 리포트: `/Users/lee/Documents/Apps/ShopWiseBar-Verify/results/verify-report.md`
- 기존 1차 PoC: `docs/tests/v0.3_crawler_poc.md`