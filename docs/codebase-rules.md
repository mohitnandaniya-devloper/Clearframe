# Codebase Rules

## Structure and boundaries

- Keep modules small enough that one screen or service can be understood without scrolling through unrelated logic.
- Extract repeated formatting, parsing, and mapping logic into shared helpers when used in more than one place.
- Do not let route files own persistence or provider logic directly.
- Keep generated or vendor-style UI wrappers inside `frontend/src/components/ui/` only.

## Cleanup standards

- Remove dead environment variables from tracked examples and docs.
- Remove stale duplicate files rather than keeping “backup” copies in the tree.
- Remove comments that restate the code instead of explaining intent or constraints.
- Delete obsolete directories when their only purpose has already moved elsewhere.

## Testing and validation

- Frontend changes should pass `pnpm lint`, `pnpm typecheck`, and `pnpm build`.
- Backend changes should pass `uv run pytest` or the equivalent virtualenv command.
- Deployment/config changes must be verified with a startup check when possible.

## CI/CD rules

- CI must validate frontend, backend, and backend Docker buildability.
- CD must only run after successful CI on `main` or by explicit manual dispatch.
- Deployment hooks must be optional and secret-driven; never hardcode vendor URLs in workflows.

## Anti-patterns to avoid

- Giant page files that mix rendering, side effects, API clients, and formatting helpers.
- Provider-specific secrets committed to tracked files.
- Duplicate Dockerfiles or deployment configs for the same service.
- Introducing new defaults that silently fall back to local-only infrastructure in production-oriented code.
