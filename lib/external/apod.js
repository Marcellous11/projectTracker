import { config } from "./config.js";
import { safeFetch, makeCached } from "./fetch-util.js";

/**
 * NASA Astronomy Picture of the Day. DEMO_KEY works but is heavily rate
 * limited; set NASA_API_KEY in env for a real one (free signup).
 */

function url() {
  return `https://api.nasa.gov/planetary/apod?api_key=${encodeURIComponent(config.nasa.key)}`;
}

async function fetchApod() {
  if (!config.signals.apod) return null;
  const data = await safeFetch(url(), { timeoutMs: 2500 });
  if (!data || !data.url) return null;
  return {
    title: String(data.title || ""),
    url: String(data.url),
    hdurl: data.hdurl ? String(data.hdurl) : null,
    mediaType: String(data.media_type || "image"),
    date: String(data.date || ""),
    explanation: String(data.explanation || ""),
    copyright: data.copyright ? String(data.copyright) : null,
  };
}

export const getApod = makeCached("apod", fetchApod, 6 * 3600); // 6 h
