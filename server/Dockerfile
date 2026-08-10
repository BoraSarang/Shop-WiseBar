# 똑바(Shop WiseBar) 서버 — 크롤러(Playwright 번들 Chromium + 실제 Chrome) 포함 배포 이미지
# PLATFORM: server · v0.16.6 (T-120g)
# Render NixPacks(python) 빌드는 non-root → `playwright install --with-deps`의 apt-get이
#   "Switching to root user ... su: Authentication failure"로 실패함 (2026-08-10 운영 실측)
# 이 Dockerfile은 베이스 이미지에서 root로 apt-get + playwright chromium을 사전 설치한다.
# v0.16.6: 올리브영 Cloudflare 챌린지 차단(운영 실측, body=89자 "잠시만 기다려 주세요... RAY_ID") 대응 —
#   실제 Google Chrome(`playwright install chrome`)도 설치해 channel="chrome"로 헤드리스 봇 감지 회피.
#   설치 실패 시 빌드를 막지 않도록 `|| true` — 없으면 번들 Chromium 폴백(기존 경로 유지).
# 로컬 mac 작업환경에는 docker가 없어 로컬 빌드 미검증 — Render가 Docker 런타임으로 빌드&검증.

FROM python:3.13-slim

# 크롤러 실행에 필요한 OS 의존성 — playwright 공식 권장 목록 (Chrome 포함 상위호환)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
        libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
        libgbm1 libasound2 libpangocairo-1.0-0 libpango-1.0-0 libcairo2 \
        libx11-6 libx11-xcb1 libxcb1 libxext6 libexpat1 fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

COPY server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && python -m playwright install chrome || true \
    && python -m playwright install chromium

COPY server/ .

EXPOSE 8000
# v0.16.12 (T-123) — 크롤러 워커는 Render 별도 worker 서비스로 분리.
#   단일 컨테이너에 uvicorn+worker(Playwright Chrome) 동시 실행 시 512MB를 압박해
#   /health가 30초로 지연되고 Render 헬스 체크(5초)가 실패해 재시작 루프를 일으켰음 (운영 실측).
#   → web 서비스는 uvicorn만 → Chrome 메모리와 완전 격리 → /health 항상 빠름.
#   worker 서비스(같은 이미지)는 `command: python -m crawlers.worker`로 별도 시작 (render.yaml).
# Render가 $PORT 주입 — 미정이면 8000 (로컬 컨테이너 테스트용)
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]