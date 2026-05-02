from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./tremorguard.db"
    jwt_secret: str = "tremor-guard-dev-secret"
    jwt_expire_minutes: int = 720
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173"
    auto_create_tables: bool = True
    enable_demo_seed: bool = False
    demo_password: str = "Demo123456"
    qwen_api_key: str = ""
    qwen_model: str = "qwen-plus"
    qwen_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    openai_base_url: str = "https://api.openai.com/v1"
    ai_request_timeout_ms: int = 8000


settings = Settings()
