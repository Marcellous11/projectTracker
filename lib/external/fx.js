import { config } from "./config.js";
import { safeFetch, makeCached } from "./fetch-util.js";

/**
 * Frankfurter — free FX rates backed by the European Central Bank.
 * Base = user's currency; rate map = base → other.
 *
 * `convert(amountCents, fromCcy, toCcy)` returns amountCents in toCcy
 * (still in cents — i.e. minor units, two decimals assumed). Pass-through
 * if from == to or rates unavailable.
 */

function ratesUrl(base) {
  return `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(base)}`;
}

async function fetchRates() {
  if (!config.signals.fx) return null;
  const base = config.user.currency;
  const data = await safeFetch(ratesUrl(base), { timeoutMs: 2000 });
  if (!data?.rates || typeof data.rates !== "object") return null;
  return {
    base,
    date: String(data.date || ""),
    rates: { [base]: 1, ...data.rates },
  };
}

export const getFxRates = makeCached("fx", fetchRates, 4 * 3600); // 4 h

/** Convert minor-unit (cents) from one currency to another using the cached rates. */
export function convertCents(amountCents, fromCcy, toCcy, fx) {
  if (!Number.isFinite(amountCents)) return null;
  if (!fromCcy || !toCcy || fromCcy === toCcy) return amountCents;
  if (!fx?.rates) return null;
  const base = fx.base;
  const rFrom = fx.rates[fromCcy];
  const rTo = fx.rates[toCcy];
  if (!rFrom || !rTo) return null;
  // Convert from→base→to via base rates.
  const inBase = amountCents / rFrom;
  return Math.round(inBase * rTo);
}
