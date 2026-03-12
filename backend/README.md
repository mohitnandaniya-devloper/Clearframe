# Clearframe Backend

FastAPI backend for broker connectivity, portfolio data, JWT auth, and market streaming.

## Environment files

Use one of these files in this directory:

- `.env.example`: committed reference
- `.env.local`: local development values
- `.env.production`: deployment values

Start by copying the example:

```bash
cp .env.example .env.local
```

## Local development

```bash
uv sync --group dev
docker compose up redis -d
APP_ENV=development uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

## Required backend-only secrets

- `SECRET_KEY`
- `ANGEL_ONE_TRADING_API_KEY`
- Any additional provider credentials needed for live broker access

These values must remain on the backend only and must never be exposed through the frontend.

## Production expectations

- Set `APP_ENV=production`
- Set a strong `SECRET_KEY`
- Set `DEBUG=false`
- Restrict `ALLOWED_ORIGINS`
- Prefer a full Postgres connection string in `DATABASE_URL`. The backend will
  normalize a plain Supabase URL to `postgresql+asyncpg` and add `ssl=require`
  automatically, so this format works:

```bash
postgresql://postgres:YOUR_DB_PASSWORD@db.your-project-ref.supabase.co:5432/postgres
```

- If you prefer not to store the full URL directly, leave `DATABASE_URL` blank and
  supply `SUPABASE_DB_HOST`, `SUPABASE_DB_PORT`, `SUPABASE_DB_NAME`,
  `SUPABASE_DB_USER`, and `SUPABASE_DB_PASSWORD` instead.
- `SUPABASE_URL` and `SUPABASE_KEY` are optional and only needed if you later call
  Supabase APIs directly from the backend.
- Provide Redis and database connection strings through deployment env vars or an
  uncommitted `.env.production`

## Tests

```bash
uv run pytest
```

## Docker

```bash
docker compose up --build
```

The compose file is intended for local development. For production, inject environment variables through your platform instead of committing env files.

## Render deployment

Render can build the backend directly from [`backend/Dockerfile`](./Dockerfile).

Recommended service settings:

- Root directory: `backend`
- Environment: `Docker`
- Health check path: `/health`

Required Render environment variables:

- `APP_ENV=production`
- `DEBUG=false`
- `SECRET_KEY=<strong-random-value>`
- `DATABASE_URL=<your-supabase-postgres-url>`
- `REDIS_URL=<your-redis-url>`
- `ALLOWED_ORIGINS=<comma-separated-frontend-origins>`

Optional useful variables:

- `WEB_CONCURRENCY=1`
- `SMARTAPI_MOCK_MODE=false`

The container binds to Render's injected `PORT` automatically.
Until database migrations are moved out of app-worker startup, `WEB_CONCURRENCY=1`
is the safer default because multiple workers can race on initial table creation.
