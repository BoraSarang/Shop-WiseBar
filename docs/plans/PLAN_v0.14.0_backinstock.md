# PLAN_v0.14.0 — 품절 복귀 알림 (T-110) + 주간 트렌드 피드 (T-111)

> 작성: 2026-08-08 · 플랫폼: server + extension · 이전: PLAN_v0.13.0_crossmall.md
> 범위: 사용자 합의로 v0.13.0에서 이월된 항목 중 **T-110(품절 복귀 알림)** 먼저 진행. T-111(주간 트렌드 피드)은 후속.

## 1. 개요

현재 시스템은 품절 **시작**(`sold_out_at` 설정)만 감지해 `sold_out` 알림을 보낸다.
재판매(가격 캡처 → `sold_out_at=None` 자동 해제)는 알림이 없어, 품절됐다가 돌아온 상품을
사용자가 놓친다. 찜 상품이 다시 살 수 있게 되면 `back_in_stock` 알림을 보낸다.

## 2. 결정 사항

| # | 결정 | 근거 |
|---|------|------|
| D1 | 서버에 `products.back_on_sale_at` 컬럼 추가 — 가격 캡처로 품절 해제되는 순간 기록 | 재판매 시각을 조회 시점에 알아야 since 기반 1회 알림 가능 |
| D2 | 복귀 알림 타입 `back_in_stock` 사용 (기존 `sold_out`과 대칭) | 확장이 타입별 라벨/배지 분기 중, 신규 타입 추가가 자연스러움 |
| D3 | `get_alerts`에서 `back_on_sale_at > since`이면 `back_in_stock` 알림 1회 — 이후 가격 하락도 정상 검사 | 품절 상태가 아니므로 하락/목표가 검사를 생략하지 않음 |
| D4 | since=None(최초 폴링)이면 복귀 알림 미발생 | 최초엔 과거 이력까지 다 알림주는 건 노이즈 |
| D5 | 마이그레이션은 `_ensure_columns` 패턴 재사용 (SQLite PRAGMA / PG IF NOT EXISTS) | 기존 인프라 |

## 3. 아키텍처

### 서버 (server/app)

- `models.py`: `Product.back_on_sale_at: datetime | None` (DateTime, nullable)
- `routers/products.py` `_apply_price`:
  - 품절 해제 시점(`product.sold_out_at is not None`이면서 이번 캡처로 None 전환)에 `back_on_sale_at = now`
  - 품절 해제 로직이 이미 `sold_out_at = None`으로 존재 → 이 분기 안에 함께 기록
- `main.py` `_ensure_columns`: `back_on_sale_at` 컬럼 추가 (SQLite: PRAGMA로 존재 여부 확인 후 ALTER; PG: IF NOT EXISTS)
- `routers/watches.py` `get_alerts`:
  - 기존 품절(sold_out) 분기 뒤에 복귀 검사 추가:
    ```python
    if w.product is not None and w.product.sold_out_at is None and w.product.back_on_sale_at is not None:
        if since is not None and _naive(w.product.back_on_sale_at) > since:
            alerts.append(AlertOut(product_id=..., alert_type="back_in_stock", price=..., previous_price=None, captured_at=back_on_sale_at))
    ```
  - 이 알림은 개별 상품당 1회(since 갱신으로 재전달 방지)
  - 이후 하락/목표가 검사는 정상 진행 (continue하지 않음)

### 확장 (extension)

- `background.js` `pollAlerts`: 알림 타입별 제목/메시지 분기 확장
  - `back_in_stock` → title "품절 해제 · 다시 살 수 있어요", message "가격 N원 · 상품명"
- `swb-ui.js`:
  - 알림 배지 라벨: `back_in_stock: { label: "재입고", cls: "t-back" }`
  - `.swb-alert .t-back` CSS (초록 계열)
- `popup.js` (팝업 알림 탭): 타입 분기에 back_in_stock 추가

## 4. 구현 단계 (T-번호)

| # | 작업 | 파일 |
|---|------|------|
| T-110a | 서버 모델+마이그레이션+복귀 기록 | models.py / main.py / products.py |
| T-110b | get_alerts back_in_stock 알림 | watches.py |
| T-110c | 확장 알림 타입 분기 (BG/FAB/팝업) | background.js / swb-ui.js / popup.js |
| T-110d | 테스트 (서버 pytest + node --check) | tests/test_watches.py 등 |
| T-110e | 문서 (CHANGELOG/TODO/manifest) + 커밋 | docs/ |

## 5. 테스트 계획

- **TC-110-1** 품절 → 가격 캡처(복귀) → since 이후 폴링에서 `back_in_stock` 1회 수신
- **TC-110-2** since 갱신 후 재폴링 → 복귀 알림 반복 없음
- **TC-110-3** since=None(최초) → 복귀 알림 없음
- **TC-110-4** 복귀 후 추가 가격 하락 → 하락 알림 정상 동작
- **TC-110-5** 확장: FAB/팝업/시스템 알림에 "재입고" 라벨 렌더

## 6. 롤백 계획

- git revert (서버/확장 커밋 단위)
- `back_on_sale_at` 컬럼은 nullable — 롤백해도 기존 데이터 무해
- 서버 배포 후 문제 시 직전 이미지 롤백

## 7. 에러코드

- 신규 에러코드 없음 (기존 E-EXT-NET-1001 재사용)

## 8. 문서 업데이트

- `docs/TODO.md` T-110 체크리스트
- `docs/CHANGELOG.md` v0.14.0
- `docs/api/ENDPOINTS.md` `/alerts` 응답 `back_in_stock` 타입 명세
- `extension/manifest.json` 버전 0.14.0
