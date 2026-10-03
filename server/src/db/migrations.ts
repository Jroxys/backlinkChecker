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
  {
    id: 5,
    name: 'password_resets',
    sql: `
      CREATE TABLE password_resets (
        id TEXT PRIMARY KEY,            -- sha256 of the emailed token
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used_at TEXT
      );
      ALTER TABLE users ADD COLUMN last_summary_at TEXT;
    `,
  },
  {
    id: 6,
    name: 'robots_snapshots',
    sql: `
      CREATE TABLE robots_snapshots (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        fetched_at TEXT NOT NULL,
        status INTEGER,
        hash TEXT NOT NULL,
        body TEXT NOT NULL
      );
      CREATE INDEX robots_snapshots_project ON robots_snapshots(project_id, fetched_at);
    `,
  },
  {
    id: 7,
    name: 'events',
    sql: `
      -- First-party product events for the founder funnel. No IPs, no fingerprints.
      CREATE TABLE events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        user_id TEXT,
        at TEXT NOT NULL
      );
      CREATE INDEX events_name_at ON events(name, at);
    `,
  },
  {
    id: 8,
    name: 'activation_emails',
    sql: `
      -- One row per onboarding nudge actually sent, so each goes out at most once.
      CREATE TABLE activation_emails (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        sent_at TEXT NOT NULL,
        PRIMARY KEY (user_id, kind)
      );
    `,
  },
  {
    id: 9,
    name: 'api_keys',
    sql: `
      CREATE TABLE api_keys (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        hash TEXT NOT NULL UNIQUE,
        prefix TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_used_at TEXT
      );
      CREATE INDEX api_keys_user ON api_keys(user_id);
    `,
  },
  {
    id: 10,
    name: 'branding',
    sql: `
      -- White-label report branding (Agency).
      ALTER TABLE users ADD COLUMN brand_name TEXT;
      ALTER TABLE users ADD COLUMN brand_logo_url TEXT;
      ALTER TABLE users ADD COLUMN brand_color TEXT;
    `,
  },
  {
    id: 11,
    name: 'teams',
    sql: `
      -- A member works inside exactly one owner's account.
      CREATE TABLE team_members (
        member_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL
      );
      CREATE INDEX team_members_owner ON team_members(owner_id);
      CREATE TABLE team_invites (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        UNIQUE (owner_id, email)
      );
    `,
  },
  {
    id: 12,
    name: 'report_sharing',
    sql: `
      -- Capability URL for a read-only client report; NULL = sharing off.
      ALTER TABLE projects ADD COLUMN report_token TEXT;
      CREATE UNIQUE INDEX projects_report_token ON projects(report_token) WHERE report_token IS NOT NULL;
      ALTER TABLE notification_settings ADD COLUMN monthly_report INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE users ADD COLUMN last_report_month TEXT;
    `,
  },
  {
    id: 13,
    name: 'domain_health',
    sql: `
      -- TLS certificate and domain registration expiry, one row per project.
      CREATE TABLE domain_health (
        project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
        cert_host TEXT,
        cert_expires_at TEXT,
        cert_issuer TEXT,
        cert_error TEXT,
        cert_checked_at TEXT,
        cert_alerted INTEGER,
        domain_expires_at TEXT,
        registrar TEXT,
        domain_checked_at TEXT,
        domain_alerted INTEGER
      );
    `,
  },
  {
    id: 14,
    name: 'subscription_id',
    sql: `
      -- The Lemon Squeezy subscription the current plan comes from; events for other subscriptions are ignored.
      ALTER TABLE users ADD COLUMN subscription_id TEXT;
    `,
  },
  {
    id: 15,
    name: 'cwv',
    sql: `
      -- Core Web Vitals history from CrUX (one JSON series per project; origin NULL = not in CrUX).
      CREATE TABLE cwv (
        project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
        origin TEXT,
        body TEXT,
        fetched_at TEXT NOT NULL
      );
    `,
  },
  {
    id: 16,
    name: 'trials_and_pausing',
    sql: `
      -- Reverse trial: new accounts run on a paid plan until trial_ends_at, then fall back to free.
      ALTER TABLE users ADD COLUMN trial_ends_at TEXT;
      ALTER TABLE users ADD COLUMN trial_reminded INTEGER NOT NULL DEFAULT 0;
      -- Entries beyond the plan's limits after a downgrade: kept, but not checked until there's room again.
      ALTER TABLE monitored_urls ADD COLUMN paused INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE backlinks ADD COLUMN paused INTEGER NOT NULL DEFAULT 0;
    `,
  },
  {
    id: 17,
    name: 'first_scan_email',
    sql: `
      ALTER TABLE projects ADD COLUMN first_scan_sent_at TEXT;
    `,
  },
  {
    id: 18,
    name: 'project_pausing',
    sql: `
      -- Projects beyond the plan's project limit after a downgrade: kept, not monitored.
      ALTER TABLE projects ADD COLUMN paused INTEGER NOT NULL DEFAULT 0;
      -- Last time we asked the paid discovery provider about this project.
      ALTER TABLE projects ADD COLUMN discovery_checked_at TEXT;
    `,
  },
  {
    id: 19,
    name: 'near_realtime_watch',
    sql: `
      -- Pages checked on the plan's fast watch interval instead of the daily schedule.
      ALTER TABLE monitored_urls ADD COLUMN priority INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE monitored_urls ADD COLUMN priority_manual INTEGER NOT NULL DEFAULT 0;
      -- Secret for the "I just deployed" hook; robots.txt is now checked per project on the watch interval.
      ALTER TABLE projects ADD COLUMN deploy_token TEXT;
      ALTER TABLE projects ADD COLUMN robots_checked_at TEXT;
      CREATE UNIQUE INDEX projects_deploy_token ON projects(deploy_token) WHERE deploy_token IS NOT NULL;
      -- Is the site up? One row per project, plus a log of outages.
      CREATE TABLE uptime (
        project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'unknown', -- up | down | unknown
        fails INTEGER NOT NULL DEFAULT 0,
        since TEXT,
        checked_at TEXT,
        response_ms INTEGER,
        last_error TEXT
      );
      CREATE TABLE outages (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        error TEXT
      );
      CREATE INDEX outages_project ON outages(project_id, started_at);
    `,
  },
  {
    id: 20,
    name: 'rank_tracking',
    sql: `
      CREATE TABLE tracked_keywords (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        keyword TEXT NOT NULL,
        created_at TEXT NOT NULL,
        serp_checked_at TEXT,
        -- The page Search Console says ranks best for this query (last 28 days)
        best_page TEXT,
        UNIQUE (project_id, keyword)
      );
      -- Where live Google results are fetched from (DataForSEO location name / language code)
      ALTER TABLE projects ADD COLUMN serp_location TEXT NOT NULL DEFAULT 'United States';
      ALTER TABLE projects ADD COLUMN serp_language TEXT NOT NULL DEFAULT 'en';
      ALTER TABLE projects ADD COLUMN rankings_synced_at TEXT;
      -- Daily position per keyword; source = gsc (average position, free) or serp (live result)
      CREATE TABLE keyword_positions (
        keyword_id TEXT NOT NULL REFERENCES tracked_keywords(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        source TEXT NOT NULL,
        position REAL,
        clicks INTEGER,
        impressions INTEGER,
        page TEXT,
        PRIMARY KEY (keyword_id, date, source)
      );
      CREATE TABLE serp_snapshots (
        id TEXT PRIMARY KEY,
        keyword_id TEXT NOT NULL REFERENCES tracked_keywords(id) ON DELETE CASCADE,
        fetched_at TEXT NOT NULL,
        results TEXT NOT NULL
      );
      CREATE INDEX serp_snapshots_kw ON serp_snapshots(keyword_id, fetched_at);
      CREATE TABLE comparisons (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        keyword_id TEXT REFERENCES tracked_keywords(id) ON DELETE CASCADE,
        keyword TEXT NOT NULL,
        my_url TEXT NOT NULL,
        their_url TEXT NOT NULL,
        result TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX comparisons_project ON comparisons(project_id, created_at);
    `,
  },
]
