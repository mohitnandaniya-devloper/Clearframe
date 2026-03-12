import pytest
from pydantic import ValidationError
from sqlalchemy.engine import make_url

from app.core.config import Settings


def test_database_url_normalizes_sqlite_scheme() -> None:
    settings = Settings(
        app_env="development",
        secret_key="local-secret-key",
        database_url="sqlite:///./local.db",
        supabase_db_host="",
        supabase_db_password="",
    )

    assert settings.database_url == "sqlite+aiosqlite:///./local.db"


def test_database_url_normalizes_supabase_postgres_scheme() -> None:
    settings = Settings(
        app_env="development",
        secret_key="local-secret-key",
        database_url="postgresql://postgres:secret@db.project-ref.supabase.co:5432/postgres",
        supabase_db_host="",
        supabase_db_password="",
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
        supabase_db_host="db.project-ref.supabase.co",
        supabase_db_port=5432,
        supabase_db_name="postgres",
        supabase_db_user="postgres",
        supabase_db_password="Reserved#Pass123!",
    )

    parsed = make_url(settings.database_url)
    assert parsed.password == "Reserved#Pass123!"
    assert parsed.host == "db.project-ref.supabase.co"
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
