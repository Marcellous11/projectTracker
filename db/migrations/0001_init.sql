-- 0001_init: clients, project_meta, time_entries.
-- See plan: ~/.claude/plans/i-definitely-love-that-velvety-taco.md.

CREATE TABLE clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT,                     -- '#rrggbb', validated in lib/clients.js
  contact_email TEXT,
  contact_phone TEXT,
  default_rate_cents INTEGER,
  default_currency TEXT DEFAULT 'USD',
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE project_meta (
  rel TEXT PRIMARY KEY,           -- soft link to scan.js's `rel`
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  rate_cents INTEGER,             -- override; null = inherit from client
  currency TEXT,
  codename TEXT,                  -- override of auto codename(rel)
  notes TEXT,
  archived_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_project_meta_client ON project_meta(client_id);

CREATE TABLE time_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_rel TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  duration_ms INTEGER GENERATED ALWAYS AS (ended_at - started_at) VIRTUAL,
  source TEXT NOT NULL CHECK (source IN ('manual','auto')),
  session_id TEXT,                -- auto: JSONL sessionId; manual: null
  note TEXT,
  billable INTEGER NOT NULL DEFAULT 1,
  rate_cents INTEGER,
  currency TEXT,
  invoice_id INTEGER,             -- nullable hook for future invoices table
  last_synced_at INTEGER,         -- auto-row freshness
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_time_project ON time_entries(project_rel, started_at);
CREATE UNIQUE INDEX uniq_auto_session ON time_entries(session_id) WHERE source = 'auto';
CREATE UNIQUE INDEX uniq_running_per_project ON time_entries(project_rel) WHERE ended_at IS NULL;
CREATE INDEX idx_running ON time_entries(project_rel) WHERE ended_at IS NULL;
