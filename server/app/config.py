# 설정 — 환경변수 기반 (시크릿 하드코딩 금지, .env 참조)
# PLATFORM: server
import os

from dotenv import load_dotenv

load_dotenv()

# 서버 API 버전 — /health 및 FastAPI title에 노출 (manifest 버전과 별개, 배포 시 갱신)
APP_VERSION = "0.16.2"


class Settings:
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./shopwisebar.db")
    api_host: str = os.getenv("API_HOST", "0.0.0.0")
    api_port: int = int(os.getenv("API_PORT", "8000"))
    cors_origins: list[str] = os.getenv("CORS_ORIGINS", "*").split(",")


settings = Settings()
