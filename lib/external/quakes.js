import { config } from "./config.js";
import { safeFetch, makeCached } from "./fetch-util.js";

/**
 * USGS Earthquakes — M4.5+/24h GeoJSON feed. Returns the most recent quakes
 * for the ticker. We cap the result; the activity feed dedupes by `id`.
 */

const URL_M4_5_DAY = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson";

async function fetchQuakes() {
  if (!config.signals.quake) return [];
  const data = await safeFetch(URL_M4_5_DAY, { timeoutMs: 2500 });
  if (!data?.features?.length) return [];
  return data.features
    .map((f) => {
      const p = f?.properties || {};
      const t = Number(p.time);
      if (!Number.isFinite(t)) return null;
      return {
        id: f.id || `${t}-${p.place}`,
        ts: new Date(t).toISOString(),
        mag: Number(p.mag) || 0,
        place: String(p.place || "unknown"),
        url: String(p.url || ""),
      };
    })
    .filter(Boolean)
    .sort((a, b) => +new Date(b.ts) - +new Date(a.ts))
    .slice(0, 20);
}

export const getQuakes = makeCached("quakes", fetchQuakes, 300); // 5 min
