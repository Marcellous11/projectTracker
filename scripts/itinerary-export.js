#!/usr/bin/env node
// Read the itinerary queue for Monday (OpenClaw). Prints the open + sent items
// as JSON so the agent can pick up what was captured in the dashboard.
//
//   node scripts/itinerary-export.js            -> open + sent (the handoff set)
//   node scripts/itinerary-export.js all        -> every item
//   node scripts/itinerary-export.js open|sent|done
//
// Read-only. Honors TRACKER_DB_PATH (falls back to ./data/tracker.db).

import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";

const arg = (process.argv[2] || "handoff").toLowerCase();
const dbPath =
  process.env.TRACKER_DB_PATH || path.resolve(process.cwd(), "data/tracker.db");

if (!fs.existsSync(dbPath)) {
  console.log(JSON.stringify({ error: "no db", dbPath, items: [] }));
  process.exit(0);
}

const db = new Database(dbPath, { readonly: true });
let rows;
if (arg === "all") {
  rows = db.prepare("SELECT * FROM itinerary ORDER BY created_at DESC").all();
} else if (["open", "sent", "done"].includes(arg)) {
  rows = db
    .prepare("SELECT * FROM itinerary WHERE status = ? ORDER BY created_at DESC")
    .all(arg);
} else {
  // handoff: what Marcellous flagged but hasn't finished
  rows = db
    .prepare(
      "SELECT * FROM itinerary WHERE status IN ('open','sent') ORDER BY created_at ASC"
    )
    .all();
}

console.log(
  JSON.stringify(
    {
      count: rows.length,
      items: rows.map((r) => ({
        id: r.id,
        body: r.body,
        project: r.project,
        status: r.status,
        created_at: new Date(r.created_at).toISOString(),
      })),
    },
    null,
    2
  )
);
