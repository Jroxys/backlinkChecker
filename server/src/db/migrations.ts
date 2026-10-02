/**
 * Append-only list of migrations. Never edit a shipped migration — add a new one.
 * SQL is kept close to standard so a later move to Postgres is mechanical.
 */
export const migrations: { id: number; name: string; sql: string }[] = [
  {
    id: 1,
    name: 'initial',
    sql: `
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        plan TEXT NOT NULL DEFAULT 'free',
        founding INTEGER NOT NULL DEFAULT 0,
        plan_renews_at TEXT,
        billing_customer_id TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,            -- sha256 of the cookie token
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
      CREATE INDEX sessions_user ON sessions(user_id);

      CREATE TABLE projects (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        domain TEXT NOT NULL,           -- normalised host, e.g. example.com
        gsc_property TEXT,              -- e.g. sc-domain:example.com
        created_at TEXT NOT NULL,
        UNIQUE (user_id, domain)
      );

      CREATE TABLE monitored_urls (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'manual',   -- manual | sitemap | import
        http_status INTEGER,
        indexable INTEGER,
        robots TEXT,                    -- allowed | blocked | noindex
        canonical TEXT,                 -- self | other | missing
        canonical_url TEXT,
        title TEXT,
        word_count INTEGER,
        load_ms INTEGER,
        in_sitemap INTEGER NOT NULL DEFAULT 0,
        index_status TEXT NOT NULL DEFAULT 'unknown', -- indexed | crawled | discovered | blocked | error | unknown
        coverage_state TEXT,            -- raw Search Console coverage string
        google_canonical TEXT,
        last_crawled_by_google TEXT,
        last_checked_at TEXT,
        index_checked_at TEXT,
        next_check_at TEXT,
        created_at TEXT NOT NULL,
        UNIQUE (project_id, url)
      );
      CREATE INDEX monitored_urls_due ON monitored_urls(next_check_at);

      CREATE TABLE url_events (
        id TEXT PRIMARY KEY,
        url_id TEXT NOT NULL REFERENCES monitored_urls(id) ON DELETE CASCADE,
        at TEXT NOT NULL,
        kind TEXT NOT NULL,             -- status_change | index_change | canonical_change | first_check
        detail TEXT NOT NULL
      );
      CREATE INDEX url_events_url ON url_events(url_id, at);

      CREATE TABLE backlinks (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        source_url TEXT NOT NULL,
        source_domain TEXT NOT NULL,
        target_url TEXT NOT NULL DEFAULT '', -- expected target; '' = any URL on the project domain
        found_target TEXT,              -- target actually found on the page
        anchor TEXT,
        rel TEXT,                       -- dofollow | nofollow | ugc | sponsored
        status TEXT NOT NULL DEFAULT 'pending', -- pending | active | lost | broken | blocked
        origin TEXT NOT NULL DEFAULT 'manual',  -- manual | import | discovery
        authority INTEGER,
        page_noindex INTEGER NOT NULL DEFAULT 0,
        http_status INTEGER,
        last_error TEXT,
        miss_count INTEGER NOT NULL DEFAULT 0,
        first_seen TEXT,
        last_seen TEXT,
        last_checked_at TEXT,
        next_check_at TEXT,
        created_at TEXT NOT NULL,
        UNIQUE (project_id, source_url, target_url)
      );
      CREATE INDEX backlinks_due ON backlinks(next_check_at);
      CREATE INDEX backlinks_project ON backlinks(project_id, status);

      CREATE TABLE backlink_checks (
        id TEXT PRIMARY KEY,
        backlink_id TEXT NOT NULL REFERENCES backlinks(id) ON DELETE CASCADE,
        at TEXT NOT NULL,
        http_status INTEGER,
        found INTEGER NOT NULL,
        rel TEXT,
        anchor TEXT,
        error TEXT
      );
      CREATE INDEX backlink_checks_bl ON backlink_checks(backlink_id, at);

      CREATE TABLE sitemaps (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending', -- pending | ok | error
        url_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        last_fetched_at TEXT,
        created_at TEXT NOT NULL,
        UNIQUE (project_id, url)
      );

      CREATE TABLE alerts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,             -- index | backlink | technical | sitemap | competitor | robots
        severity TEXT NOT NULL,         -- critical | warning | info | success
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        href TEXT,
        created_at TEXT NOT NULL,
        read_at TEXT,
        notified_at TEXT
      );
      CREATE INDEX alerts_user ON alerts(user_id, created_at);

      CREATE TABLE notification_settings (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        email INTEGER NOT NULL DEFAULT 1,
        slack_webhook TEXT,
        webhook_url TEXT,
        digest INTEGER NOT NULL DEFAULT 0,
        min_severity TEXT NOT NULL DEFAULT 'warning'
      );

      CREATE TABLE jobs (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        payload TEXT NOT NULL DEFAULT '{}',
        run_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued', -- queued | running | done | failed
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        locked_at TEXT,
        dedupe_key TEXT UNIQUE,
        created_at TEXT NOT NULL
      );
      CREATE INDEX jobs_ready ON jobs(status, run_at);

      CREATE TABLE google_connections (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        email TEXT,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        expires_at TEXT NOT NULL,
        scope TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE competitors (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        domain TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (project_id, domain)
      );

      CREATE TABLE oauth_states (
        state TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL
      );
    `,
  },
  {
    id: 2,
    name: 'daily_stats',
    sql: `
      -- One row per project per day, upserted by the hourly snapshot job. Powers every trend chart.
      CREATE TABLE daily_stats (
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        date TEXT NOT NULL,             -- YYYY-MM-DD (UTC)
        urls INTEGER NOT NULL DEFAULT 0,
        indexed INTEGER NOT NULL DEFAULT 0,
        crawled INTEGER NOT NULL DEFAULT 0,
        discovered INTEGER NOT NULL DEFAULT 0,
        not_indexed INTEGER NOT NULL DEFAULT 0,
        indexable INTEGER NOT NULL DEFAULT 0,
        backlinks INTEGER NOT NULL DEFAULT 0,
        ref_domains INTEGER NOT NULL DEFAULT 0,
        gained INTEGER NOT NULL DEFAULT 0,
        lost INTEGER NOT NULL DEFAULT 0,
        issues INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (project_id, date)
      );
    `,
  },
  {
    id: 3,
    name: 'oauth_return_to',
    sql: `ALTER TABLE oauth_states ADD COLUMN return_to TEXT;`,
  },
  {
    id: 4,
    name: 'gsc_cache',
    sql: `
      -- Cached Search Console Search Analytics responses (keyed by project + query signature).
      CREATE TABLE gsc_cache (
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        key TEXT NOT NULL,
        body TEXT NOT NULL,
        fetched_at TEXT NOT NULL,
        PRIMARY KEY (project_id, key)
      );
    `,
  },
]
