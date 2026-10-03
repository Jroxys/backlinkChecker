# Indexora

**Know exactly what Google sees.** SEO monitoring for people who'd rather be told than have to check: index status from Search Console, indexability checks on every URL, and every backlink re-verified on the linking page itself.

What runs for every project:

- **Indexing:** Search Console URL Inspection, plus our own status, noindex, canonical and robots checks, sitemap sync and a robots.txt watcher.
- **Backlinks:** daily re-verification (link, anchor, rel, linking page indexable), import from any SEO tool's CSV, and weekly discovery (Pro+).
- **Site health:**
  - SSL certificate expiry and trust, domain registration expiry (RDAP).
  - Core Web Vitals from the Chrome UX Report.
- **Insights:** rule-based audit, Search Console keywords, and opportunities (lost-link reclaim, 404 redirects, competitor gap).
- **Outputs:**
  - Alerts by email, Slack or webhook, with a weekly summary and a monthly report.
  - Printable and shareable client reports, white-label on Agency.
  - CSV export and a REST API with personal keys.
- **Accounts:** teams with seats; Lemon Squeezy billing with founding prices; a founder metrics page at `/app/admin`.

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

Open `/demo` for the sample-data demo, `/signup` to create a real account, `/tools` for the four free checkers (backlink, indexability, redirect, SSL).

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
