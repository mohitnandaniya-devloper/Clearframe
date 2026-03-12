# Clearframe

Clearframe is an analytics-focused stock intelligence workspace with:

- `frontend/`: a React + Vite dashboard for market insights, watchlists, and portfolio-aware analysis
- `backend/`: a FastAPI service for auth, broker connectivity, portfolio retrieval, and market streaming

The product is designed for research and insight generation. Broker connections are used to fetch portfolio context, not to place trades from this application.

## Repository Layout

```text
.
├── .github/workflows/        CI automation
├── backend/                  FastAPI app, tests, Docker assets
├── docs/                     Deployment and publishing notes
├── frontend/                 React app, static assets, build config
├── CONTRIBUTING.md           Developer contribution guidance
└── README.md                 Repository overview and setup
```

## Environment Strategy

Each app follows the same pattern:

- `.env.example`: committed, safe template with placeholders
- `.env.local`: local development values only, never commit
- `.env.production`: deployment values only, never commit

Quick start:

```bash
cp backend/.env.example backend/.env.local
cp frontend/.env.example frontend/.env.local
```

Important rules:

- Keep all real secrets in untracked env files or your deployment platform
- Never put broker provider keys in frontend `VITE_` variables
- Use restrictive `ALLOWED_ORIGINS` and `DEBUG=false` in production

## Local Development

### Backend

```bash
cd backend
uv sync --group dev
docker compose up redis -d
APP_ENV=development uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Frontend

```bash
cd frontend
pnpm install
pnpm dev --host 127.0.0.1 --port 5173
```

## Validation

Backend:

```bash
cd backend
uv run pytest
```

Frontend:

```bash
cd frontend
pnpm typecheck
pnpm build
```

## Deployment Notes

- Set `APP_ENV=production`
- Set a strong backend `SECRET_KEY`
- Set `DEBUG=false`
- Restrict `ALLOWED_ORIGINS`
- Provide backend secrets through your platform or an uncommitted `backend/.env.production`
- Provide frontend environment values at build/deploy time through an uncommitted `frontend/.env.production`
- See [docs/deployment.md](docs/deployment.md) for a fuller deployment and pre-publish checklist

## Repository Hygiene

- Do not commit `.env`, `.env.local`, or `.env.production`
- Do not commit local databases, logs, build outputs, caches, or virtual environments
- Review `git status --ignored` before publishing if you want to verify ignored local-only artifacts

## License

No license file is included yet. Choose and add a license before publishing publicly on GitHub.
