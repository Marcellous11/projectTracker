#!/usr/bin/env node
// VACUUM INTO snapshot — safe to run while the dashboard is live.
// Run via: npm run db:backup

import path from "node:path";
import fs from "node:fs";
import { getDb } from "../lib/db.js";

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const outDir = path.resolve(process.cwd(), "data");
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `backup-${todayIso()}.db`);

if (fs.existsSync(out)) fs.unlinkSync(out);

const db = getDb();
db.prepare("VACUUM INTO ?").run(out);
console.log(`backed up to ${out}`);
