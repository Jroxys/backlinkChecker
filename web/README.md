# Indexora — web app

Frontend for **Indexora**, an SEO intelligence and automation platform: index monitoring, backlink intelligence, technical audits, competitor gaps, automations, alerts and client-ready reports.

The app runs entirely on realistic, seeded mock data (`src/data`), so every screen is populated without a backend.

## Stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · React Router · Recharts · Lucide icons · Inter

## Run

```bash
cd web
npm install
npm run dev        # http://localhost:5173  (landing) · /app (dashboard)
npm run build      # typecheck + production build
```

## Routes

| Route | Screen |
| --- | --- |
| `/` | Marketing landing page |
| `/app` | Dashboard |
| `/app/projects` | Projects (with new-project wizard) |
| `/app/indexing` · `/app/indexing/:id` | Index coverage, URL table · URL inspection detail |
| `/app/backlinks` · `/app/opportunities` | Backlink intelligence · Backlink opportunities |
| `/app/audit` · `/app/keywords` · `/app/competitors` | SEO audit · Rank tracking · Competitor comparison |
| `/app/automations` · `/app/alerts` · `/app/reports` · `/app/settings` | Automation center · Notification center · Reports · Settings |

Press <kbd>⌘K</kbd> / <kbd>Ctrl K</kbd> anywhere in the app for the command palette.

## Structure

```
src/
  components/
    ui/          Button, Card, Badge, Modal, Dropdown/Select, Tabs/Segmented, Tooltip, Table,
                 Pagination, MetricCard, Sparkline, ScoreRing, Toast, EmptyState, Skeleton,
                 StatusIndicator, DatePicker, SearchInput, Checkbox, Switch, Logo …
    layout/      Header, Sidebar, CommandPalette, PageHeader, nav config
    charts/      Shared tooltip, legend, axis + domain helpers for Recharts
    domain/      UrlTable, IndexingChart, status badges
    marketing/   Landing-page product preview
  layouts/       AppLayout (shell, collapsible sidebar, mobile drawer)
  pages/         app/* and marketing/*
  data/          Seeded mock data (projects, URLs, backlinks, audit, alerts …)
  hooks/ lib/ types/ utils/
```

## Design system

- **Tokens** live as CSS variables in `src/index.css` (`--bg`, `--surface`, `--line`, `--fg-*`, `--primary*`, semantic colors) and are exposed to Tailwind via `@theme inline`. Light and dark are designed separately (dark uses `#0B0F19`), toggled with the `.dark` class.
- **Brand color** is Indigo `#6366F1`. Yellow is not used anywhere; amber `#F59E0B` appears only for semantic warning states.
- **Chart palette** (`src/lib/chartColors.ts`) is a fixed-order categorical set validated for lightness, chroma, colour-vision-deficiency separation and contrast on both surfaces. Indigo is always the primary series.
- Numbers use tabular figures (`.tnum`) and `Intl.NumberFormat` grouping.
