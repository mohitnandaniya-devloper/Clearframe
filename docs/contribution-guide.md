# Contribution Guide

## Before changing code

- Review the nearest feature folder before adding files.
- Prefer extending an existing module boundary instead of creating a new pattern.
- Update docs when changing deployment, environment, or workflow behavior.

## Adding frontend code

- Put route-specific UI in `src/pages/`.
- Move reusable UI and non-route feature widgets into `src/components/`.
- Put API helpers and browser storage helpers into `src/lib/`.
- If a page file grows past a few hundred lines, split panels or hooks by responsibility.

## Adding backend code

- Put request handling in `app/api/`.
- Put orchestration in `app/services/`.
- Put provider SDK code in `app/integrations/`.
- Put infrastructure wiring in `app/core/` or `app/db/`, not in route files.

## Cleanup expectations

- If you touch a file with stale comments, duplicate branches, or unused imports, clean them in the same change when practical.
- Keep examples and READMEs aligned with the actual runtime behavior.
- Do not add “temporary” files to the repository root.

## GitHub readiness

- Keep tracked files free of secrets.
- Keep workflows readable and minimal.
- Prefer one canonical file per concern, especially for deployment and container setup.
