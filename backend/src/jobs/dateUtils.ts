/**
 * Timezone-safe date utilities for per-store date handling.
 *
 * Uses only built-in Intl APIs — no third-party libraries needed.
 * Works correctly for ALL IANA timezones including fractional offsets
 * (India UTC+5:30, Nepal UTC+5:45) and large positive offsets (NZ UTC+13).
 */

/**
 * Returns the store's current local date as "YYYY-MM-DD".
 * Safe to use for DailyMetric date keys.
 *
 * @example storeLocalDateStr("Africa/Lagos")   // "2026-03-20"
 * @example storeLocalDateStr("America/New_York") // "2026-03-19" (at midnight WAT)
 */
export function storeLocalDateStr(timezone: string, date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(date);
}

/**
 * Returns { start, end } as UTC timestamps covering the store's full local day.
 *
 * How it works:
 *   1. Get the local date string (YYYY-MM-DD) in the store's timezone.
 *   2. Compute the UTC offset by comparing the local components vs UTC epoch.
 *   3. UTC midnight of the local date = Date.UTC(y, m, d) - offsetMs.
 *
 * @example
 *   storeLocalDayBounds("Africa/Lagos")    // UTC+1
 *   // start → 2026-03-19T23:00:00.000Z   (local midnight)
 *   // end   → 2026-03-20T22:59:59.999Z   (local 23:59:59)
 *
 *   storeLocalDayBounds("America/New_York") // UTC-5 (EST)
 *   // start → 2026-03-20T05:00:00.000Z
 *   // end   → 2026-03-21T04:59:59.999Z
 *
 *   storeLocalDayBounds("Asia/Kolkata")     // UTC+5:30 (IST)
 *   // start → 2026-03-19T18:30:00.000Z
 *   // end   → 2026-03-20T18:29:59.999Z
 */
export function storeLocalDayBounds(
  timezone: string,
  date: Date = new Date()
): { start: Date; end: Date } {
  // Step 1: Local date string ("YYYY-MM-DD") in the store's timezone
  const localDateStr = storeLocalDateStr(timezone, date);
  const [y, m, d] = localDateStr.split("-").map(Number);

  // Step 2: Measure UTC offset at `date`
  //   - Get each local time component separately (Intl is the only reliable source)
  //   - Reconstruct "local time as if it were UTC" and compare with actual UTC
  const fmt = (part: Intl.DateTimeFormatPartTypes) =>
    parseInt(
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        [part === "hour" ? "hour" : part]: "2-digit",
        ...(part === "hour" ? { hour12: false } : {}),
      })
        .formatToParts(date)
        .find((p) => p.type === part)!.value
    );

  const localH   = fmt("hour");
  const localMin = fmt("minute");
  const localSec = fmt("second");

  // "Local time expressed as UTC milliseconds" minus actual UTC milliseconds
  const localAsUtcMs = Date.UTC(y, m - 1, d, localH, localMin, localSec);
  const offsetMs = localAsUtcMs - date.getTime(); // positive = UTC+, negative = UTC-

  // Step 3: UTC timestamp of local midnight
  const localMidnightUtcMs = Date.UTC(y, m - 1, d) - offsetMs;

  return {
    start: new Date(localMidnightUtcMs),
    end:   new Date(localMidnightUtcMs + 86_400_000 - 1), // +23:59:59.999
  };
}

/**
 * Returns the current local hour (0–23) in the given timezone.
 * Used by the daily-sync scheduler to find stores in their 2am window.
 */
export function storeLocalHour(timezone: string, date: Date = new Date()): number {
  return parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      hour12: false,
    }).format(date)
  );
}
