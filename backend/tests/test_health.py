import importlib

from httpx import ASGITransport, AsyncClient

from app.core.config import get_settings


async def test_health_endpoint(monkeypatch) -> None:
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", "sqlite+aiosqlite:///./test.db")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("SECRET_KEY", "test-secret-key")

    get_settings.cache_clear()
    app = importlib.import_module("app.main").app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
