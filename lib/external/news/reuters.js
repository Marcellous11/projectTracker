import { config } from "../config.js";
import { safeFetch, makeCached } from "../fetch-util.js";
import { parseFeed, toIso, clip } from "./_rss.js";

/**
 * Reuters Agency's public RSS endpoint returned 404 in 2026 (they moved to a
 * paid syndication model). We replace it with Al Jazeera English's all-feed
 * — a non-Western-anchored world-news perspective that pairs nicely with the
 * BBC + GDELT mix. Source tag "AJZ".
 *
 * The file + config flag are kept named "reuters" so existing env toggles
 * keep working; only the rendered source label changed.
 */

const URL = "https://www.aljazeera.com/xml/rss/all.xml";

async function fetchAjz() {
  if (!config.signals.newsRtrs) return [];
  const xml = await safeFetch(URL, { timeoutMs: 2500, parse: "text" });
  if (!xml) return [];
  return parseFeed(xml)
    .filter((it) => it.title && it.link)
    .slice(0, 20)
    .map((it) => ({
      id: it.guid || it.link,
      source: "AJZ",
      scope: "world",
      title: it.title,
      url: it.link,
      ts: toIso(it.pubDate) || new Date().toISOString(),
      summary: it.description ? clip(it.description, 280) : "",
    }));
}

export const getReutersHeadlines = makeCached("news-reuters", fetchAjz, 300);
