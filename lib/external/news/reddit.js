import { config } from "../config.js";
import { safeFetch, makeCached } from "../fetch-util.js";
import { clip } from "./_rss.js";

/**
 * Local news via r/<USER_SUBREDDIT>/hot.json (anonymous).
 *
 * Reddit blocks default user-agents, so safeFetch sends one we set in the
 * shared fetch-util. We filter out stickied/distinguished mod posts which
 * are usually meta or megathreads.
 */

function url(sub) {
  return `https://www.reddit.com/r/${encodeURIComponent(sub)}/hot.json?limit=20`;
}

async function fetchReddit() {
  if (!config.signals.newsRddt) return [];
  const sub = config.user.subreddit;
  if (!sub) return [];
  const data = await safeFetch(url(sub), {
    timeoutMs: 3000,
    headers: { "user-agent": "project-tracker/1.0 (+local dashboard)" },
  });
  const children = data?.data?.children;
  if (!Array.isArray(children)) return [];
  return children
    .map((c) => c?.data)
    .filter((p) => p && !p.stickied && !p.over_18 && p.title)
    .slice(0, 15)
    .map((p) => ({
      id: p.id || p.permalink,
      source: "RDDT",
      scope: "local",
      title: p.title,
      url: `https://www.reddit.com${p.permalink}`,
      ts: new Date(Number(p.created_utc) * 1000).toISOString(),
      summary: p.selftext ? clip(p.selftext, 280) : (p.link_flair_text ? `[${p.link_flair_text}]` : ""),
    }));
}

export const getRedditHeadlines = makeCached("news-reddit", fetchReddit, 600); // 10 min
