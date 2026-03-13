# Deployment Notes

## Environment strategy

### Backend

- Use `backend/.env.local` for local development only.
- Use `backend/.env.production` only on your deployment target or in a private local deployment workflow.
- Commit only `backend/.env.example`.
- Prefer Supabase for Postgres and Upstash for Redis.
- Use `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, and `DATABASE_PASSWORD`, or provide `DATABASE_URL` directly if your platform manages a single URL secret.
- Set `REDIS_URL` to the Upstash Redis protocol endpoint (`rediss://...`), not the REST API URL.
- If your platform injects `DATABASE_URL` directly, prefer that as the canonical production setting and remove stale split `DATABASE_*` values from the service environment.

### Frontend

- Use `frontend/.env.local` for local development only.
- Use `frontend/.env.production` only for production builds and deployment.
- Commit only `frontend/.env.example`.
- Treat every `VITE_` variable as public, because it is bundled into the browser build.

## Production checklist

### Backend

- Set `APP_ENV=production`
- Set `DEBUG=false`
- Set a strong `SECRET_KEY`
- Restrict `ALLOWED_ORIGINS`
- Set `SMARTAPI_MOCK_MODE=false` for live integrations
- Provide Supabase Postgres credentials and an Upstash `REDIS_URL`

### Frontend

- Set `VITE_API_BASE_URL` to the deployed backend API URL
- Avoid placing server-only credentials in any `VITE_` variable

## Pre-publish checklist

- Run `git status --ignored`
- Confirm tracked files do not contain secrets, passwords, or private tokens
- Remove local build outputs, caches, logs, and generated metadata
- Verify both frontend and backend still pass their local validation commands
- Choose and add a repository license before making the repository public

## GitHub Actions CD

The repository includes:

- `CI`: validates frontend, backend, and backend Docker image builds
- `CD`: runs after successful `CI` on `main`, publishes `ghcr.io/<owner>/<repo>/backend`, and can trigger platform deploy hooks

Optional repository secrets:

- `BACKEND_DEPLOY_HOOK_URL`: deploy hook for the backend platform, such as Render
- `FRONTEND_DEPLOY_HOOK_URL`: deploy hook for the frontend platform

## Local validation commands

### Backend

```bash
cd backend
uv run ruff check .
uv run pytest
```

Optional startup sanity check:

```bash
cd backend
APP_ENV=production uv run python -c "from app.core.config import Settings; print(Settings().database_debug_summary)"
```

### Frontend

```bash
cd frontend
pnpm typecheck
pnpm build
```
