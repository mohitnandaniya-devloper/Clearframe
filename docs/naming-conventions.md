# Naming Conventions

## General

- Use clear domain names over implementation names.
- Prefer singular file names for single concepts: `service.py`, `market-data.ts`.
- Use `PascalCase` for React component files.
- Use `kebab-case` for non-component frontend utility files.
- Use `snake_case` for Python modules.

## Frontend

- Route shells: `SomethingPage.tsx`
- Major dashboard subviews: `SomethingTab.tsx`
- Reusable UI primitives stay under `components/ui/` and keep the primitive name.
- Feature components should include the feature noun in the file name.
- Avoid vague names like `helpers.ts`, `misc.ts`, or `common.ts`.

## Backend

- Service modules should be named `service.py` inside a feature folder.
- Integration wrappers should be named after the provider capability, for example `client.py` or `websocket.py`.
- API route modules should map to the exposed resource, for example `portfolio.py`, `market.py`.
- Settings fields should use `database_*`, `redis_*`, and provider-prefixed names consistently.

## Environment variables

- Use provider-neutral names when the value is runtime-critical, for example `DATABASE_HOST`, `REDIS_URL`.
- Keep backward-compatible aliases only in config parsing, not in docs or examples.
- Do not store unused secrets or duplicate provider variables in tracked examples.
