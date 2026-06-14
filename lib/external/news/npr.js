import { config } from "../config.js";
import { safeFetch, makeCached } from "../fetch-util.js";
import { parseFeed, toIso, clip } from "./_rss.js";

const URL = "https://feeds.npr.org/1001/rss.xml";

async function fetchNpr() {
  if (!config.signals.newsNpr) return [];
  const xml = await safeFetch(URL, { timeoutMs: 2500, parse: "text" });
  if (!xml) return [];
  return parseFeed(xml)
    .filter((it) => it.title && it.link)
    .slice(0, 20)
    .map((it) => ({
      id: it.guid || it.link,
      source: "NPR",
      scope: "federal",
      title: it.title,
      url: it.link,
      ts: toIso(it.pubDate) || new Date().toISOString(),
      summary: it.description ? clip(it.description, 280) : "",
    }));
}

export const getNprHeadlines = makeCached("news-npr", fetchNpr, 300);
