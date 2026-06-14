import { config } from "./config.js";
import { safeFetch, makeCached } from "./fetch-util.js";

/**
 * Nager.Date — public-holiday lookup per country. The /Next30 endpoint
 * is cheap enough to call once per day per country code.
 *
 * Returns `[ {date: "YYYY-MM-DD", name, type} … ]`. Caller can compute
 * "is today a holiday" or "next holiday in N days".
 */

function url(country) {
  return `https://date.nager.at/api/v3/NextPublicHolidays/${encodeURIComponent(country)}`;
}

async function fetchHolidays(country) {
  if (!config.signals.hol) return [];
  if (!country) return [];
  const data = await safeFetch(url(country.toUpperCase()), { timeoutMs: 2000 });
  if (!Array.isArray(data)) return [];
  return data
    .map((h) => ({
      date: String(h.date || ""),
      name: String(h.name || h.localName || ""),
      type: String(h.types?.[0] || "Public"),
    }))
    .filter((h) => h.date);
}

const cached = makeCached("holidays", fetchHolidays, 24 * 3600);

export function getHolidays(country) {
  return cached(country || config.user.country);
}

/** Returns the today-or-null holiday for a country. */
export async function getTodayHoliday(country) {
  const list = await getHolidays(country);
  const today = new Date().toISOString().slice(0, 10);
  return list.find((h) => h.date === today) || null;
}
