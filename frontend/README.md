# Clearframe Frontend

React 19 + Vite client for the Clearframe broker dashboard.

## Environment files

Use one of these files in this directory:

- `.env.example`: committed reference
- `.env.local`: local development values
- `.env.production`: deployment values

Start by copying the example:

```bash
cp .env.example .env.local
```

## Required variables

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
VITE_BACKEND_DEMO_EMAIL=
VITE_BACKEND_DEMO_PASSWORD=
```

`VITE_BACKEND_DEMO_EMAIL` and `VITE_BACKEND_DEMO_PASSWORD` are optional local-only
convenience values for the demo login flow. Anything prefixed with `VITE_` is sent
to the browser, so never place provider secrets or server-only credentials here.

## Run locally

```bash
pnpm install
pnpm dev --host 127.0.0.1
```

If you prefer working from the repository root, use the root pnpm workspace and run
frontend commands with `pnpm --dir frontend ...`.

## Production build

```bash
pnpm build
```

## Notes

- Vite automatically loads `.env.local` for development and `.env.production` for production builds.
- Do not place sensitive server-only credentials in frontend env files, because `VITE_` variables are bundled for the browser.
- Broker API keys are now expected on the backend only and should never be exposed to the frontend bundle.
- Route-level screens stay under `src/pages/`; reusable feature widgets belong in `src/components/`.
