import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";

// Singleton across HMR reloads in dev.
const g = globalThis;

function dbPath() {
  return process.env.TRACKER_DB_PATH || path.resolve(process.cwd(), "data/tracker.db");
}

function migrationsDir() {
  return path.resolve(process.cwd(), "db/migrations");
}

function ensureDir(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function runMigrations(d) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at INTEGER NOT NULL
    );
  `);

  const dir = migrationsDir();
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  } catch {
    return; // no migrations dir yet — fresh checkout, nothing to apply
  }

  const applied = new Set(
    d.prepare("SELECT name FROM _migrations").all().map((r) => r.name)
  );

  for (const name of files) {
    if (applied.has(name)) continue;
    const sql = fs.readFileSync(path.join(dir, name), "utf8");
    const tx = d.transaction(() => {
      d.exec(sql);
      d.prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)").run(name, Date.now());
    });
    tx();
  }
}

function openDb() {
  const file = dbPath();
  ensureDir(file);
  const d = new Database(file);
  d.pragma("journal_mode = WAL");
  d.pragma("foreign_keys = ON");
  runMigrations(d);
  return d;
}

export function getDb() {
  if (!g.__trackerDb) g.__trackerDb = openDb();
  return g.__trackerDb;
}

export const now = () => Date.now();
