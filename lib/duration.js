/** Format ms as "Hh Mm" (or "Mm" under 1h). Zero → "0m". */
export function fmtDuration(ms) {
  if (!ms || ms <= 0) return "0m";
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** ms → decimal hours rounded to .01. */
export function toHours(ms) {
  if (!ms || ms <= 0) return 0;
  return Math.round((ms / 3600000) * 100) / 100;
}

/** Format minor units (cents) as "USD 150.00" or with given currency. */
export function fmtMoney(cents, currency = "USD") {
  if (cents == null) return "—";
  return `${currency} ${(Number(cents) / 100).toFixed(2)}`;
}

/** Convert a duration ms + rate (cents/hour) into a money string. */
export function billed(ms, rateCents, currency = "USD") {
  if (!ms || !rateCents) return null;
  const hours = ms / 3600000;
  const cents = Math.round(hours * rateCents);
  return fmtMoney(cents, currency);
}
