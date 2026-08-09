# 똑바(Shop WiseBar) 서버 — 크롤러(Playwright 번들 Chromium) 포함 배포 이미지
# PLATFORM: server · v0.16.4 (T-120)
# Render NixPacks(python) 빌드는 non-root → `playwright install --with-deps`의 apt-get이
#   "Switching to root user ... su: Authentication failure"로 실패함 (2026-08-10 운영 실측)
# 이 Dockerfile은 베이스 이미지에서 root로 apt-get + playwright chromium을 사전 설치한다.
# 로컬 mac 작업환경에는 docker가 없어 로컬 빌드 미검증 — Render가 Docker 런타임으로 빌드&검증.

FROM python:3.13-slim

# 크롤러(Chromium headless shell) 실행에 필요한 OS 의존성 — playwright 공식 권장 목록
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
    && python -m playwright install chromium

COPY server/ .

EXPOSE 8000
# Render가 $PORT 주입 — 미정이면 8000 (로컬 컨테이너 테스트용)
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} & python -m crawlers.worker"]