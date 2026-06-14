import { config } from "./config.js";
import { safeFetch, makeCached } from "./fetch-util.js";

/**
 * GitHub notifications — requires a PAT (read:notifications scope).
 * If GH_TOKEN is absent the source is auto-disabled in config and this
 * returns null, which the OwedChip uses to render nothing.
 */

const URL = "https://api.github.com/notifications";

async function fetchOwed() {
  if (!config.signals.owed) return null;
  const token = config.github.token;
  if (!token) return null;
  const data = await safeFetch(URL, {
    timeoutMs: 2000,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
    },
  });
  if (!Array.isArray(data)) return null;
  // Count unread threads (the endpoint already filters to unread by default).
  return { unread: data.length };
}

export const getOwed = makeCached("gh-owed", fetchOwed, 120); // 2 min
