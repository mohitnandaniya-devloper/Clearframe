import os
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal
from urllib.parse import parse_qsl, quote, urlencode, urlsplit, urlunsplit

from pydantic import AliasChoices, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]
APP_ENV_FILE = os.getenv("APP_ENV", "development").strip().lower()
ENV_FILE_NAMES = (
    (".env", ".env.production")
    if APP_ENV_FILE in {"production", "prod"}
    else (".env", ".env.local")
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=tuple(BASE_DIR / name for name in ENV_FILE_NAMES),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
        populate_by_name=True,
    )

    app_name: str = "Clearframe SmartAPI Backend"
    app_env: Literal["development", "staging", "production", "test"] = "development"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"
    secret_key: str = Field(
        default="change-me",
        min_length=8,
        validation_alias=AliasChoices("SECRET_KEY", "JWT_SECRET_KEY"),
    )
    access_token_expire_minutes: int = 30
    refresh_token_expire_minutes: int = 60 * 24 * 7
    jwt_algorithm: str = Field(
        default="HS256",
        validation_alias=AliasChoices("JWT_ALGORITHM"),
    )

    sqlite_path: str = str(BASE_DIR / "clearframe.db")
    database_url: str = Field(
        default=f"sqlite+aiosqlite:///{sqlite_path}",
        validation_alias=AliasChoices("DATABASE_URL"),
    )
    database_host: str = Field(
        default="",
        validation_alias=AliasChoices("DATABASE_HOST", "SUPABASE_DB_HOST"),
    )
    database_port: int = Field(
        default=5432,
        validation_alias=AliasChoices("DATABASE_PORT", "SUPABASE_DB_PORT"),
    )
    database_name: str = Field(
        default="postgres",
        validation_alias=AliasChoices("DATABASE_NAME", "SUPABASE_DB_NAME"),
    )
    database_user: str = Field(
        default="postgres",
        validation_alias=AliasChoices("DATABASE_USER", "SUPABASE_DB_USER"),
    )
    database_password: str = Field(
        default="",
        validation_alias=AliasChoices("DATABASE_PASSWORD", "SUPABASE_DB_PASSWORD"),
    )

    redis_url: str = Field(
        default="redis://redis:6379/0",
        validation_alias=AliasChoices("REDIS_URL"),
    )
    redis_channel_prefix: str = "market"
    cache_key_prefix: str = Field(
        default="clearframe",
        validation_alias=AliasChoices("CACHE_KEY_PREFIX"),
    )
    broker_status_cache_ttl_seconds: int = Field(
        default=30,
        validation_alias=AliasChoices("BROKER_STATUS_CACHE_TTL_SECONDS"),
    )
    portfolio_snapshot_cache_ttl_seconds: int = Field(
        default=15,
        validation_alias=AliasChoices("PORTFOLIO_SNAPSHOT_CACHE_TTL_SECONDS"),
    )
    rate_limit_per_minute: int = Field(
        default=120,
        validation_alias=AliasChoices("RATE_LIMIT_PER_MINUTE"),
    )
    database_pool_size: int = Field(
        default=5,
        validation_alias=AliasChoices("DATABASE_POOL_SIZE"),
    )
    database_max_overflow: int = Field(
        default=10,
        validation_alias=AliasChoices("DATABASE_MAX_OVERFLOW"),
    )
    database_pool_recycle_seconds: int = Field(
        default=1800,
        validation_alias=AliasChoices("DATABASE_POOL_RECYCLE_SECONDS"),
    )
    database_connect_timeout_seconds: float = Field(
        default=10.0,
        validation_alias=AliasChoices("DATABASE_CONNECT_TIMEOUT_SECONDS"),
    )
    database_connect_max_retries: int = Field(
        default=5,
        validation_alias=AliasChoices("DATABASE_CONNECT_MAX_RETRIES"),
    )
    database_connect_retry_delay_seconds: float = Field(
        default=2.0,
        validation_alias=AliasChoices("DATABASE_CONNECT_RETRY_DELAY_SECONDS"),
    )

    angel_one_api_key: str = Field(
        default="",
        validation_alias=AliasChoices(
            "ANGEL_ONE_API_KEY",
            "ANGEL_ONE_TRADING_API_KEY",
            "ANGEL_ONE_MARKET_API_KEY",
        ),
    )
    smartapi_timeout_seconds: int = Field(
        default=15,
        validation_alias=AliasChoices("SMARTAPI_TIMEOUT_SECONDS", "REQUEST_TIMEOUT_SECONDS"),
    )
    smartapi_reconnect_max_attempts: int = 10
    smartapi_reconnect_backoff_seconds: float = 1.5
    smartapi_mock_mode: bool = False
    supabase_url: str = Field(
        default="",
        validation_alias=AliasChoices("SUPABASE_URL"),
    )
    supabase_key: str = Field(
        default="",
        validation_alias=AliasChoices("SUPABASE_KEY"),
    )
    allowed_origins: Annotated[list[str], NoDecode] = ["*"]
    metrics_enabled: bool = True

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def parse_allowed_origins(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            if not stripped:
                return ["*"]
            if stripped.startswith("["):
                return value
            return [item.strip() for item in stripped.split(",") if item.strip()]
        return value

    @field_validator("app_env", mode="before")
    @classmethod
    def parse_app_env(cls, value: object) -> object:
        if isinstance(value, str):
            aliases = {
                "dev": "development",
                "prod": "production",
            }
            return aliases.get(value.strip().lower(), value.strip().lower())
        return value

    @field_validator("debug", mode="before")
    @classmethod
    def parse_debug(cls, value: object) -> object:
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"1", "true", "yes", "on", "debug"}:
                return True
            if normalized in {"0", "false", "no", "off", "release", "prod"}:
                return False
        return value

    @field_validator("database_url", mode="before")
    @classmethod
    def parse_database_url(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            if stripped.startswith("sqlite:///") and not stripped.startswith(
                "sqlite+aiosqlite:///"
            ):
                return stripped.replace("sqlite:///", "sqlite+aiosqlite:///", 1)
            if stripped.startswith("postgres://"):
                stripped = stripped.replace("postgres://", "postgresql://", 1)
            if stripped.startswith("postgresql://"):
                stripped = stripped.replace("postgresql://", "postgresql+asyncpg://", 1)
            if ".supabase.co" in stripped:
                parsed = urlsplit(stripped)
                query_params = dict(parse_qsl(parsed.query, keep_blank_values=True))
                query_params.pop("pgbouncer", None)
                query_params.pop("sslmode", None)
                query_params.setdefault("ssl", "require")
                stripped = urlunsplit(parsed._replace(query=urlencode(query_params)))
            return stripped
        return value

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        if self.database_host and self.database_password:
            encoded_user = quote(self.database_user, safe="")
            encoded_password = quote(self.database_password, safe="")
            encoded_database = quote(self.database_name, safe="")
            self.database_url = (
                f"postgresql+asyncpg://{encoded_user}:{encoded_password}"
                f"@{self.database_host}:{self.database_port}/{encoded_database}"
                "?ssl=require"
            )

        if self.app_env != "production":
            return self

        if self.secret_key == "change-me":
            raise ValueError("Set a strong SECRET_KEY or JWT_SECRET_KEY for production.")

        if self.debug:
            raise ValueError("DEBUG must be disabled in production.")

        if self.allowed_origins == ["*"]:
            raise ValueError("ALLOWED_ORIGINS must be restricted in production.")

        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
