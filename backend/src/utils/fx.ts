/**
 * FX (Foreign Exchange) Utility
 * ─────────────────────────────────────────────────────────────────────────────
 * Fetches live exchange rates from open.er-api.com (free, no key required).
 * Rates are cached in-memory for 1 hour to avoid hammering the API.
 *
 * Usage:
 *   const rate = await getExchangeRate("USD", "NGN");  // e.g. 1600
 *   const naira = usd * rate;
 *
 * Fail-open: returns 1.0 if the API call fails, with a console warning.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { fetchWithRetry } from "./http.js";

const FX_API_BASE = "https://open.er-api.com/v6/latest";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Pluggable warn function — replaced in worker/server context to use pino.
// Defaults to console.warn so the module works in tests without a logger.
let fxWarn: (msg: string) => void = (msg) => console.warn(msg);

/** Override the FX warning logger (call from server/worker startup). */
export function setFxLogger(warn: (msg: string) => void): void {
  fxWarn = warn;
}

interface FxCache {
  rates: Record<string, number>;
  fetchedAt: number;
}

// In-memory cache keyed by base currency (e.g. "USD")
const fxCache = new Map<string, FxCache>();

/**
 * Returns the exchange rate from `from` to `to`.
 * E.g. getExchangeRate("USD", "NGN") → ~1600
 */
export async function getExchangeRate(from: string, to: string): Promise<number> {
  if (from === to) return 1;

  const fromUpper = from.toUpperCase();
  const toUpper   = to.toUpperCase();

  const cached = fxCache.get(fromUpper);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rates[toUpper] ?? 1;
  }

  try {
    const res = await fetchWithRetry(`${FX_API_BASE}/${fromUpper}`, {}, { timeoutMs: 5_000, retries: 2 });
    if (!res.ok) throw new Error(`FX API ${res.status}`);

    const json = await res.json() as { rates?: Record<string, number> };
    if (!json.rates) throw new Error("FX API: no rates in response");

    fxCache.set(fromUpper, { rates: json.rates, fetchedAt: Date.now() });
    return json.rates[toUpper] ?? 1;
  } catch (err) {
    // Fail-open: return 1:1 so callers still produce a value. This means
    // revenue on multi-currency stores will be recorded at face value until
    // the FX service recovers. Callers should monitor this warn in prod.
    fxWarn(`[fx] Could not fetch ${fromUpper}→${toUpper} rate: ${(err as Error).message} — using 1:1 fallback`);
    return 1;
  }
}

/**
 * Convert an amount from one currency to another.
 * Returns the original amount unchanged if the same currency or if FX lookup fails.
 */
export async function convertCurrency(
  amount: number,
  from: string,
  to: string
): Promise<number> {
  const rate = await getExchangeRate(from, to);
  return amount * rate;
}

/** Clears the FX cache (useful in tests). */
export function clearFxCache(): void {
  fxCache.clear();
}
