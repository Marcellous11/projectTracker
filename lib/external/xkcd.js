import { config } from "./config.js";
import { safeFetch, makeCached } from "./fetch-util.js";

/**
 * Latest xkcd. JSON endpoint, no key. Updated MWF — cache 6h.
 */

const URL = "https://xkcd.com/info.0.json";

async function fetchXkcd() {
  if (!config.signals.xkcd) return null;
  const data = await safeFetch(URL, { timeoutMs: 2000 });
  if (!data?.img) return null;
  return {
    num: Number(data.num) || 0,
    title: String(data.safe_title || data.title || ""),
    img: String(data.img),
    alt: String(data.alt || ""),
    link: `https://xkcd.com/${data.num}/`,
  };
}

export const getXkcd = makeCached("xkcd", fetchXkcd, 6 * 3600);
