# 세션 로그 — 2026-08-10 (server, 크롤러 OOM/수집 0건 진단) — session-2

## 1. 무엇을
- T-120g (v0.16.6): 운영 진단 로그로 **수집 0건 원인 = Cloudflare 챌린지 차단 확정** (`og:title 없음 body=89자 "잠시만 기다려 주세요... RAY_ID"`).
- 대응: Dockerfile에 `playwright install chrome`(실제 Google Chrome) + `--disable-blink-features=AutomationControlled` + oliveyoung 챌린지 자동 해결 재대기(5s×3회). APP_VERSION 0.16.6.

## 2. 플랫폼
- server. v0.16.5 메모리 경량화는 운영 로그로 검증 완료 (배치 3건 34.8s + `브라우저 리소스 해제 완료`, 워커 재시작 없음).
- v0.16.4 구간(00:02/00:06)은 10건·144~156s → 워커 재시작 2회 = OOM 재발 (배포 전 컷).

## 3. 구현/빌드
- `Dockerfile`: `python -m playwright install chrome || true` 추가 (실패해도 빌드 유지, 번들 Chromium 폴백).
- `_browser.py`: `_LAUNCH_ARGS`에 `--disable-blink-features=AutomationControlled` (navigator.webdriver 감지 회피).
- `oliveyoung.py`: 챌린지 문구("잠시만 기다려/접속 정보를 확인") 감지 시 5s 간격 최대 3회 재대기.
- `APP_VERSION` 0.16.6 + CHANGELOG/TODO(T-120g)/ops/README 반영.

## 4. 검증
- pytest 75건 통과. 로컬 실수집(시스템 Chrome) 올리브영 성공 3건 (프로티원 25,900원 등).
- **운영 효과 검증은 Render 배포 후 필요** — channel="chrome"이 Cloudflare에 통과하는지 확인.

## 5. 남은 TODO
- T-120h: v0.16.6 배포 후 운영 `/crawler/logs` — 브라우저 로그가 "시스템 Chrome"인지 + attempted>0 확인.
- 재차단 시 대안: 서버 크롤러는 보조 경로이므로 **한국 로컬에서만 크롤링** 옵션 (확장 업로드가 주 데이터 경로).

## 6. 다음 에이전트 전달
- 커밋 `(예정)` v0.16.6 push 후 Render 자동 배포 대기 → 수동 트리거 후 로그 확인.
- 관심 패턴: `브라우저: 시스템 Chrome` (channel chrome 로드 성공 여부), `배치 oliveyoung: N건 수집 / 3건 시도`.

## 7. 문서 업데이트
- CHANGELOG v0.16.6 / TODO T-120g / ops/README v0.16.6 / session 로그 본 파일.

## 8. 커밋
- (push 대기)