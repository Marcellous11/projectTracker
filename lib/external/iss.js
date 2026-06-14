import { config } from "./config.js";
import { safeFetch, makeCached } from "./fetch-util.js";

/**
 * ISS current position + crew count. Two endpoints, both anonymous:
 *   - wheretheiss.at — lat/lon/altitude/velocity (more reliable)
 *   - open-notify.org — crew list (people in space)
 *
 * Failures degrade independently: missing position still returns crew count
 * (and vice versa). Both null → caller hides chip.
 */

const POS_URL_PRIMARY = "http://api.open-notify.org/iss-now.json";
const POS_URL_FALLBACK = "https://api.wheretheiss.at/v1/satellites/25544";
const CREW_URL = "http://api.open-notify.org/astros.json";

async function fetchIss() {
  if (!config.signals.iss) return null;
  // open-notify endpoints occasionally hover near 2s. Give them 3s — still
  // well under the SSR budget thanks to Promise.allSettled at the call site.
  const [posPrim, crew] = await Promise.allSettled([
    safeFetch(POS_URL_PRIMARY, { timeoutMs: 3000 }),
    safeFetch(CREW_URL, { timeoutMs: 3000 }),
  ]);
  let posData = posPrim.status === "fulfilled" ? posPrim.value : null;
  let lat = null, lon = null;
  if (posData?.iss_position) {
    lat = Number(posData.iss_position.latitude);
    lon = Number(posData.iss_position.longitude);
  }
  // Fallback only if primary missed (don't pay the latency otherwise).
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    const fb = await safeFetch(POS_URL_FALLBACK, { timeoutMs: 2500 });
    if (fb && Number.isFinite(fb.latitude) && Number.isFinite(fb.longitude)) {
      lat = fb.latitude; lon = fb.longitude;
    }
  }
  const c = crew.status === "fulfilled" ? crew.value : null;
  const out = {};
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    out.lat = +lat.toFixed(2);
    out.lon = +lon.toFixed(2);
  }
  if (c && Array.isArray(c.people)) {
    out.crew = c.people.filter((x) => x?.craft === "ISS").length || c.number || c.people.length;
  }
  return Object.keys(out).length ? out : null;
}

export const getIss = makeCached("iss", fetchIss, 30); // 30 s
