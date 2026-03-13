import pytest
from pydantic import ValidationError
from sqlalchemy.engine import make_url

from app.core.config import Settings


def test_database_url_normalizes_sqlite_scheme() -> None:
    settings = Settings(
        app_env="development",
        secret_key="local-secret-key",
        database_url="sqlite:///./local.db",
        database_host="",
        database_password="",
    )

    assert settings.database_url == "sqlite+aiosqlite:///./local.db"


def test_database_url_normalizes_supabase_postgres_scheme() -> None:
    settings = Settings(
        app_env="development",
        secret_key="local-secret-key",
        database_url="postgresql://postgres:secret@db.project-ref.supabase.co:5432/postgres",
        database_host="",
        database_password="",
    )

    assert (
        settings.database_url
        == "postgresql+asyncpg://postgres:secret@db.project-ref.supabase.co:5432/postgres?ssl=require"
    )


def test_supabase_password_with_reserved_characters_is_encoded_safely() -> None:
    settings = Settings(
        app_env="development",
        secret_key="local-secret-key",
        database_url="postgresql://postgres:placeholder@db.project-ref.supabase.co:5432/postgres",
        database_host="db.project-ref.supabase.co",
        database_port=5432,
        database_name="postgres",
        database_user="postgres",
        database_password="Reserved#Pass123!",
    )

    parsed = make_url(settings.database_url)
    assert parsed.password == "Reserved#Pass123!"
    assert parsed.host == "db.project-ref.supabase.co"
    assert parsed.drivername == "postgresql+asyncpg"
    assert settings.database_url.endswith("?ssl=require")


def test_pooler_database_url_is_built_from_env_parts() -> None:
    settings = Settings(
        app_env="production",
        secret_key="production-secret-key",
        debug=False,
        allowed_origins=["https://clearframe.app"],
        database_host="aws-1-ap-southeast-2.pooler.supabase.com",
        database_port=6543,
        database_name="postgres",
        database_user="postgres.project-ref",
        database_password="Reserved#Pass123!",
    )

    parsed = make_url(settings.database_url)
    assert parsed.password == "Reserved#Pass123!"
    assert parsed.host == "aws-1-ap-southeast-2.pooler.supabase.com"
    assert parsed.port == 6543
    assert parsed.database == "postgres"
    assert parsed.drivername == "postgresql+asyncpg"
    assert settings.database_url.endswith("?ssl=require")


def test_production_settings_require_safe_values() -> None:
    with pytest.raises(ValidationError):
        Settings(
            app_env="production",
            secret_key="change-me",
            debug=False,
            allowed_origins=["https://clearframe.app"],
        )

    with pytest.raises(ValidationError):
        Settings(
            app_env="production",
            secret_key="production-secret-key",
            debug=True,
            allowed_origins=["https://clearframe.app"],
        )

    with pytest.raises(ValidationError):
        Settings(
            app_env="production",
            secret_key="production-secret-key",
            debug=False,
            allowed_origins=["*"],
        )
