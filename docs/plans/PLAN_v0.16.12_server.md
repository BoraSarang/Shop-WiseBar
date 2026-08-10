# PLAN_v0.16.12_server.md — 크롤러 워커를 Render 별도 서비스로 분리 (web health 30초 지연 / 재시작 루프 근본 해결)

작성일: 2026-08-10 · 플랫폼: server · 버전: v0.16.12(T-123)

## 1. 개요

운영 실측: 크롤러 배치 실행 중 `/health`가 11~31초로 지연되어 Render 헬스 체크(5초)
타임아웃 → 인스턴스 강제 재시작이 반복됨 (2026-08-10 10:47~10:48 UTC 재현).

원인: `server/Dockerfile` CMD가 **같은 컨테이너**에서 `uvicorn`과 `python -m crawlers.worker`를
동시에 실행(`&`). Playwright(Chrome) 렌더링이 스타티운드 512MB 메모리를 압박하면
컨테이너 전체의 응답(=/health)이 swap/지연되고, Render가 5초 안에 응답 못 받으면 인스턴스를 죽임.

## 2. 결정 사항

- 크롤러 워커(`crawlers/worker.py`)를 **Render의 별도 worker 서비스**로 분리한다.
- web 서비스는 uvicorn만 실행 → Chrome 메모리와 완전 격리 → `/health`는 항상 빠르게 응답.
- 별도 서비스면 worker가 OOM·지연돼도 web(/health)은 영향 없음, Render 헬스 체크는 web만 대상.

## 3. 아키텍처

```
Render 서비스 1 (web, 유료화): uvicorn app.main:app — API + /health
Render 서비스 2 (worker, 같은 이미지): python -m crawlers.worker — Playwright 배치
공용: Neon PostgreSQL (DATABASE_URL), 크롤러 설정/이력은 DB로 반영
```

- 배치 주기·트리거는 DB `crawler_config`/`crawler_runs` 기반이라 두 서비스가 따로 돌아도 무방.
- worker 서비스는 health check 없음 (Render가 재시작해도 web은 안전).

## 4. 구현 단계 (T-번호)

- [T-123a] `Dockerfile` CMD → uvicorn 단독 실행 (worker 제거)
- [T-123b] `render.yaml` → web + worker 두 서비스 정의 (worker: `command: python -m crawlers.worker`, healthcheck 없음)
- [T-123c] 로컬 검증: `python -m crawlers.worker --once`로 배치 정상 확인
- [T-123d] 배포 후 `/health` 지연 재현 여부 확인 (배치 중 3회 측정, 5초 미만 목표)

## 5. 테스트 계획 (TC-번호)

- [TC-123-1] worker 분리 후 배치 동작: worker 서비스에서 oliveyoung/naver run_once 정상 기록
- [TC-123-2] web /health: 배치 실행 중에도 5초 내 200 응답
- [TC-123-3] 트리거 연동: POST /admin/crawler/run → worker가 30초 내 소비

## 6. 롤백

worker 서비스를 비활성화하고 Dockerfile CMD를 원복(`&`)하면 기존 단일 컨테이너 구조로 복구.

## 7. 영향

- 배포 방식 변경(Render Dashboard에서 새 worker 서비스 생성/apply 필요)
- 무료 티어라면 web 1 + worker 1 → 2개 서비스 (요금 플랜 확인 필요)
- 코드 로직 변경 최소 (worker.py는 유지, CMD/render.yaml만 수정)