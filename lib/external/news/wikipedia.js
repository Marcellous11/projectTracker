import { config } from "../config.js";
import { safeFetch, makeCached } from "../fetch-util.js";
import { clip } from "./_rss.js";

/**
 * Wikipedia "On this day" — a JSON feed of historical events that happened
 * on today's date. Anonymous, no key. Refresh once per 6 h.
 *
 * Path is `/feed/onthisday/events/<MM>/<DD>` — we compute it at fetch time
 * so the cache key (which is keyed by `external/v2/news-wikipedia`) shares
 * across the day's TTL.
 */

function url() {
  const d = new Date();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/${mm}/${dd}`;
}

async function fetchWiki() {
  if (!config.signals.newsWce) return [];
  const data = await safeFetch(url(), { timeoutMs: 3000 });
  const events = Array.isArray(data?.events) ? data.events : [];
  return events
    .filter((e) => e?.text && Array.isArray(e?.pages) && e.pages.length)
    .slice(0, 10)
    .map((e) => {
      const year = Number(e.year) || null;
      const page = e.pages[0];
      const link = page?.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${page?.title || ""}`;
      return {
        id: `wce:${year}:${page?.title || e.text.slice(0, 40)}`,
        source: "WCE",
        scope: "context",
        title: year ? `${year} · ${e.text}` : e.text,
        url: link,
        // We deliberately use today's midnight UTC so these sort to the
        // bottom of the daily mix without claiming a fake recent timestamp.
        ts: new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").toISOString(),
        summary: page?.extract ? clip(String(page.extract), 280) : "",
      };
    });
}

export const getWikipediaHeadlines = makeCached("news-wikipedia", fetchWiki, 6 * 3600);
