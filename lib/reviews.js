import fs from "node:fs";
import path from "node:path";
import { cache } from "react";

// Reads the reviews-sync snapshot. The /review page never shells out at request
// time — a systemd timer keeps this file fresh (every few hours).
const REVIEWS_PATH =
  process.env.REVIEWS_PATH || path.resolve(process.cwd(), "data/reviews.json");

const STALE_MS = 6 * 60 * 60 * 1000; // 6h without a sync = considered stale

export const getReviews = cache(() => {
  try {
    const d = JSON.parse(fs.readFileSync(REVIEWS_PATH, "utf8"));
    const ageMs = d.generatedAt ? Date.now() - new Date(d.generatedAt).getTime() : null;
    return {
      ok: true,
      generatedAt: d.generatedAt || null,
      ageMs,
      stale: ageMs == null || ageMs > STALE_MS,
      day: d.day || { back: null, ahead: null, context: {} },
      week: d.week || { back: null, ahead: null, context: {} },
      month: d.month || { back: null, ahead: null, context: {} },
    };
  } catch {
    return {
      ok: false,
      generatedAt: null,
      ageMs: null,
      stale: true,
      day: { back: null, ahead: null, context: {} },
      week: { back: null, ahead: null, context: {} },
      month: { back: null, ahead: null, context: {} },
    };
  }
});
