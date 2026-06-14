import { config } from "../config.js";
import { safeFetch, makeCached } from "../fetch-util.js";
import { clip } from "./_rss.js";

/**
 * GDELT 2.0 DOC API — JSON, no key. We ask for English-language top-news
 * articles from the last 24h, sorted by hybrid relevance (their popularity +
 * recency metric). The query "sourcelang:eng" gives us English coverage
 * across the whole global publisher pool, including local US outlets.
 */

const URL =
  "https://api.gdeltproject.org/api/v2/doc/doc" +
  "?query=sourcelang:eng%20domainis:reuters.com%20OR%20domainis:apnews.com%20OR%20domainis:bbc.com%20OR%20domainis:aljazeera.com" +
  "&mode=ArtList&format=json&maxrecords=20&sort=hybridrel&timespan=24h";

async function fetchGdelt() {
  if (!config.signals.newsGdlt) return [];
  // GDELT's DOC API is consistently slow (~3–6s); allow a longer budget.
  const data = await safeFetch(URL, { timeoutMs: 6000 });
  const arts = Array.isArray(data?.articles) ? data.articles : [];
  return arts
    .filter((a) => a?.title && a?.url)
    .slice(0, 15)
    .map((a) => {
      // GDELT timestamps are like "20260528T143000Z"
      const raw = String(a.seendate || "");
      let iso = null;
      const m = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
      if (m) iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
      return {
        id: a.url,
        source: "GDLT",
        scope: "world",
        title: String(a.title),
        url: String(a.url),
        ts: iso || new Date().toISOString(),
        summary: a.socialimage ? "" : (a.domain ? `via ${a.domain}` : ""),
      };
    });
}

export const getGdeltHeadlines = makeCached("news-gdelt", fetchGdelt, 600);
