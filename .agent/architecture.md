# Clearframe Architecture

## Repository shape

- `frontend/`: React + Vite client application
- `backend/`: FastAPI service, broker integration, and streaming
- `docs/`: deployment and repository documentation
- `.github/workflows/`: CI/CD automation

## Frontend module layout

- `src/pages/`: route-level screens and page shells
- `src/components/`: reusable UI and feature-specific components
- `src/lib/`: API clients, data adapters, and shared runtime utilities
- `src/providers/`: app-wide React providers
- `src/hooks/`: focused reusable hooks
- `src/data/`: static seed/demo datasets only
- `src/types/`: local ambient typings only when package typings are unavailable

## Backend module layout

- `app/api/`: FastAPI route registration, request dependencies, and websocket endpoints
- `app/services/`: application services and orchestration logic
- `app/integrations/`: broker or external provider SDK wrappers
- `app/streaming/`: market event publishing and subscription flow
- `app/db/`: database engine/session setup and ORM models
- `app/schemas/`: request and response models
- `app/core/`: settings, logging, security, container wiring, and infrastructure helpers
- `app/domain/`: domain constants and event objects with no framework coupling
- `app/workers/`: background task entrypoints

## Architectural rules

- Keep external provider code inside `backend/app/integrations/`.
- Keep route handlers thin; push business logic into `backend/app/services/`.
- Keep page-level data wiring inside page files; move reusable UI into `frontend/src/components/`.
- Treat `frontend/src/lib/` as the boundary for API and storage helpers, not for rendering.
- Do not introduce new top-level folders unless they serve a clear cross-cutting concern.

## Current pressure points

- `frontend/src/pages/broker/PortfolioDashboard.tsx` is still too large and should be split further by feature panels.
- `frontend/src/pages/broker/StockDetailPage.tsx` still mixes page state, websocket wiring, and presentation.
- `frontend/src/components/ui/sidebar.tsx` is a large generated wrapper and should stay isolated from feature logic.
