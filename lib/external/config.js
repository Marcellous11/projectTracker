/**
 * Single env-driven config surface for external signals.
 *
 * Every value is read once at module load. Per-source feature flags default on;
 * required-input checks (e.g. weather needs coords) disable the source silently
 * if the input is missing.
 */

function bool(v, dflt) {
  if (v === undefined || v === null || v === "") return dflt;
  const s = String(v).toLowerCase();
  if (s === "0" || s === "off" || s === "false" || s === "no") return false;
  if (s === "1" || s === "on" || s === "true" || s === "yes") return true;
  return dflt;
}

function num(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const lat = num(process.env.USER_LAT);
const lon = num(process.env.USER_LON);

// Local-news source: explicit subreddit wins; otherwise USER_CITY normalized
// to a likely-subreddit name (lowercase, no spaces). If neither set, local
// feed is silently disabled.
const cityRaw = process.env.USER_CITY ? String(process.env.USER_CITY).trim() : "";
const subreddit = (process.env.USER_SUBREDDIT || cityRaw.toLowerCase().replace(/\s+/g, ""))
  .replace(/^r\//i, "")
  .trim() || null;

export const config = {
  user: {
    coords: lat != null && lon != null ? { lat, lon } : null,
    currency: (process.env.USER_CURRENCY || "USD").toUpperCase(),
    country: (process.env.USER_COUNTRY || "US").toUpperCase(),
    city: cityRaw || null,
    subreddit, // for r/<sub>/hot.json — local news source
  },
  github: {
    token: process.env.GH_TOKEN || process.env.GITHUB_TOKEN || null,
  },
  nasa: {
    key: process.env.NASA_API_KEY || "DEMO_KEY",
  },
  // Per-source feature flags (default on; weather/owed/local-news auto-disable on missing input).
  signals: {
    kp:     bool(process.env.SIGNAL_KP, true),
    iss:    bool(process.env.SIGNAL_ISS, true),
    quake:  bool(process.env.SIGNAL_QUAKE, true),
    wx:     bool(process.env.SIGNAL_WX, true) && lat != null && lon != null,
    hn:     bool(process.env.SIGNAL_HN, true),
    infra:  bool(process.env.SIGNAL_INFRA, true),
    fx:     bool(process.env.SIGNAL_FX, true),
    hol:    bool(process.env.SIGNAL_HOL, true),
    apod:   bool(process.env.SIGNAL_APOD, true),
    xkcd:   bool(process.env.SIGNAL_XKCD, true),
    npm:    bool(process.env.SIGNAL_NPM, true),
    owed:   bool(process.env.SIGNAL_OWED, true) && !!(process.env.GH_TOKEN || process.env.GITHUB_TOKEN),
    // News sources (Phase 9). Each defaults on; RDDT auto-disables without a subreddit.
    newsAp:    bool(process.env.SIGNAL_NEWS_AP, true),
    newsNpr:   bool(process.env.SIGNAL_NEWS_NPR, true),
    newsBbc:   bool(process.env.SIGNAL_NEWS_BBC, true),
    newsRtrs:  bool(process.env.SIGNAL_NEWS_RTRS, true),
    newsGdlt:  bool(process.env.SIGNAL_NEWS_GDLT, true),
    newsRddt:  bool(process.env.SIGNAL_NEWS_RDDT, true) && !!subreddit,
    newsWce:   bool(process.env.SIGNAL_NEWS_WCE, true),
  },
};
