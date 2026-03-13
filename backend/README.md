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
APP_ENV=development uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Local development expects real Supabase and Upstash credentials in `.env.local`.

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
- Prefer Supabase Postgres via the split env vars `DATABASE_HOST`,
  `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, and `DATABASE_PASSWORD`.
  The backend will assemble the async SQLAlchemy URL with `ssl=require`
  automatically.

Optional override if your platform only gives you a single DSN:

```bash
postgresql://postgres:YOUR_DB_PASSWORD@db.your-project-ref.supabase.co:5432/postgres
```

- Use Upstash Redis with a Redis protocol URL:

```bash
rediss://default:YOUR_UPSTASH_PASSWORD@your-upstash-host.upstash.io:6379
```

- Do not use the Upstash REST URL/token for this backend; it relies on Redis protocol
  commands and pub/sub.
- Provide Redis and database credentials through deployment env vars or an
  uncommitted `.env.production`.

## Tests

```bash
uv run pytest
```

## Docker

```bash
docker compose up --build
```

The compose file only runs the API and worker containers. It does not provision Redis
or Postgres. For both local and production runs, point the backend at Supabase and
Upstash through environment variables.

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
- `DATABASE_URL=<render-postgres-url>` or the split `DATABASE_*` values below
- `DATABASE_HOST=<your-supabase-pooler-host>`
- `DATABASE_PORT=6543`
- `DATABASE_NAME=postgres`
- `DATABASE_USER=<your-supabase-db-user>`
- `DATABASE_PASSWORD=<your-supabase-db-password>`
- `REDIS_URL=<your-upstash-rediss-url>`
- `ALLOWED_ORIGINS=<comma-separated-frontend-origins>`

Optional useful variables:

- `WEB_CONCURRENCY=1`
- `SMARTAPI_MOCK_MODE=false`

The container binds to Render's injected `PORT` automatically.
Until database migrations are moved out of app-worker startup, `WEB_CONCURRENCY=1`
is the safer default because multiple workers can race on initial table creation.

If Render provides `DATABASE_URL`, prefer that single setting and remove stale
split `DATABASE_HOST` or `DATABASE_PASSWORD` values from the service env to avoid
configuration drift.
