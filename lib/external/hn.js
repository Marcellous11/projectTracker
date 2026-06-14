import { config } from "./config.js";
import { safeFetch, makeCached } from "./fetch-util.js";

/**
 * Hacker News top stories — anonymous Firebase API.
 *
 * Returns the current top 5 stories with title, url, score, and a timestamp.
 * Ticker callers can dedupe by `id`.
 */

const TOP_URL = "https://hacker-news.firebaseio.com/v0/topstories.json";
const ITEM = (id) => `https://hacker-news.firebaseio.com/v0/item/${id}.json`;

async function fetchTopHn() {
  if (!config.signals.hn) return [];
  const ids = await safeFetch(TOP_URL, { timeoutMs: 2000 });
  if (!Array.isArray(ids) || !ids.length) return [];
  const top = ids.slice(0, 5);
  const items = await Promise.allSettled(
    top.map((id) => safeFetch(ITEM(id), { timeoutMs: 1500 }))
  );
  return items
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter((it) => it && it.title && !it.deleted && !it.dead)
    .map((it) => ({
      id: String(it.id),
      ts: new Date((Number(it.time) || 0) * 1000).toISOString(),
      title: String(it.title),
      url: String(it.url || `https://news.ycombinator.com/item?id=${it.id}`),
      score: Number(it.score) || 0,
    }));
}

export const getTopHn = makeCached("hn", fetchTopHn, 120); // 2 min
