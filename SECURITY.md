# Security Notes

## Secrets

- Never commit `.env`, `.env.local`, or `.env.production`
- Keep broker/provider credentials on the backend only
- Do not place sensitive values in frontend `VITE_` variables

## Before Publishing

1. Review `git status --ignored`
2. Confirm no local secrets were copied into tracked files, docs, examples, or tests
3. Regenerate any credentials that were previously stored insecurely in local env files if they were ever exposed outside your machine

## Reporting

If you discover a security issue, avoid opening a public issue with the full details until the maintainer has a chance to review it privately.
