import { config } from "./config.js";
import { safeFetch, makeCached } from "./fetch-util.js";

/**
 * NOAA Space Weather Prediction Center — planetary K-index.
 *
 * Returns the most recent Kp reading (0-9). Kp ≥ 5 = geomagnetic storm.
 * Endpoint shape: [["time_tag","kp","a_running","station_count"], [row...], ...]
 */

const KP_URL = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json";

async function fetchKp() {
  if (!config.signals.kp) return null;
  const data = await safeFetch(KP_URL);
  if (!Array.isArray(data) || !data.length) return null;
  // SWPC returns either:
  //   - object rows: [{time_tag, Kp, a_running, station_count}, …]
  //   - legacy tuple rows: [[header...], [time, kp, ...], …]
  const last = data[data.length - 1];
  let kp, tsRaw;
  if (Array.isArray(last)) {
    if (last.length < 2) return null;
    kp = Number(last[1]);
    tsRaw = String(last[0] || "");
  } else if (last && typeof last === "object") {
    kp = Number(last.Kp ?? last.kp ?? last.kp_index);
    tsRaw = String(last.time_tag || "");
  } else {
    return null;
  }
  if (!Number.isFinite(kp)) return null;
  const iso = tsRaw ? new Date(tsRaw.replace(" ", "T") + (tsRaw.endsWith("Z") ? "" : "Z")) : null;
  return {
    kp,
    ts: iso && !Number.isNaN(+iso) ? iso.toISOString() : null,
    storm: kp >= 5,
  };
}

export const getKp = makeCached("kp", fetchKp, 300); // 5 min
