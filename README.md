# Indexora

**Know exactly what Google sees.** SEO monitoring for people who'd rather be told than have to check: index status from Search Console, indexability checks on every URL, and every backlink re-verified on the linking page itself.

| | |
|---|---|
| `web/` | React + TypeScript + Vite + Tailwind front end (marketing site, app, public demo, free tools) |
| `server/` | Node + Hono API, SQLite, background worker, crawler |
| `deploy/` | Docker Compose (app + Caddy + Litestream) and Fly.io config |
| `docs/` | How it works, pricing, decisions, deployment, launch plan (Turkish) |

## Run locally

```bash
# API + worker (http://localhost:8787)
cd server && cp .env.example .env && npm install && npm run dev

# Web app with hot reload (http://localhost:5173, proxies /api to :8787)
cd web && npm install && npm run dev
```

Open `/demo` for the sample-data demo, `/signup` to create a real account, `/tools` for the free checkers.

## Test

```bash
cd server && npm test        # crawler, state machine, API security, audit, billing webhooks …
cd web && npx tsc -b         # type-check the front end
```

## Docs (Turkish)

- [docs/NASIL-CALISIR.md](docs/NASIL-CALISIR.md) — how backlink monitoring, discovery and index checks work
- [docs/PRICING.md](docs/PRICING.md) — pricing for a zero-customer launch
- [docs/DECISIONS.md](docs/DECISIONS.md) — decision log
- [docs/DEPLOY.md](docs/DEPLOY.md) — production deployment
- [docs/LANSMAN.md](docs/LANSMAN.md) — launch plan

The original Python prototype (`main.py`) is kept for reference; its idea — check that your links still exist — now lives in `server/src/services/backlinks.ts`.
