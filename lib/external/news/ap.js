import { config } from "../config.js";
import { safeFetch, makeCached } from "../fetch-util.js";
import { parseFeed, toIso, clip } from "./_rss.js";

/**
 * AP's own RSS (apnews.com/index.rss) started returning 401 in 2026. We
 * fall back to Google News' US "Nation" topic feed — which surfaces top
 * AP/Reuters/NYT stories. Source tag is "USA" so it's clear this isn't
 * AP-direct anymore.
 *
 * The file is still named ap.js + the config flag stays SIGNAL_NEWS_AP so
 * env toggles don't need updating; only the displayed source label changed.
 */

const URL = "https://news.google.com/rss/headlines/section/topic/NATION?hl=en-US&gl=US&ceid=US:en";

async function fetchUsa() {
  if (!config.signals.newsAp) return [];
  const xml = await safeFetch(URL, { timeoutMs: 3000, parse: "text" });
  if (!xml) return [];
  return parseFeed(xml)
    .filter((it) => it.title && it.link)
    .slice(0, 20)
    .map((it) => ({
      id: it.guid || it.link,
      source: "USA",
      scope: "federal",
      title: it.title.replace(/\s+-\s+[^-]+$/, ""), // strip trailing " - PublisherName"
      url: it.link,
      ts: toIso(it.pubDate) || new Date().toISOString(),
      summary: it.description ? clip(it.description, 280) : "",
    }));
}

export const getApHeadlines = makeCached("news-ap", fetchUsa, 300);
