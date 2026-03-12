# Contributing

## Setup

1. Copy `backend/.env.example` to `backend/.env.local`.
2. Copy `frontend/.env.example` to `frontend/.env.local`.
3. Install backend dependencies with `uv sync --group dev`.
4. Install frontend dependencies with `pnpm install`.
5. Keep all real credentials in untracked env files only.

## Development

- Run backend tests with `cd backend && uv run pytest`.
- Run backend linting with `cd backend && uv run ruff check .`.
- Run frontend type checks with `cd frontend && pnpm typecheck`.
- Run a frontend production build with `cd frontend && pnpm build`.
- Start the backend with `APP_ENV=development uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload`.
- Start the frontend with `pnpm dev --host 127.0.0.1 --port 5173`.

## Repository hygiene

- Do not commit `.env`, `.env.local`, or `.env.production` files.
- Do not commit build artifacts, local databases, logs, or virtual environments.
- Do not commit local package-manager stores such as `.pnpm-store/`.
- Do not place provider secrets or server-only credentials in frontend `VITE_` variables.
- Prefer small, reviewable changes and update docs when setup steps change.
