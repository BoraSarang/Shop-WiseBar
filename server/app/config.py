# 설정 — 환경변수 기반 (시크릿 하드코딩 금지, .env 참조)
# PLATFORM: server
import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./shopwisebar.db")
    api_host: str = os.getenv("API_HOST", "0.0.0.0")
    api_port: int = int(os.getenv("API_PORT", "8000"))
    cors_origins: list[str] = os.getenv("CORS_ORIGINS", "*").split(",")


settings = Settings()
