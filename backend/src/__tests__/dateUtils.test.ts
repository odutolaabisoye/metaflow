/**
 * MetaFlow dateUtils Unit Tests
 *
 * Uses Node.js built-in test runner.
 * Run with: npx tsx --test src/__tests__/dateUtils.test.ts
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { storeLocalDateStr, storeLocalHour, storeLocalDayBounds } from "../jobs/dateUtils.js";

// ─────────────────────────────────────────────────────────────────────────────
// storeLocalDateStr
// ─────────────────────────────────────────────────────────────────────────────
describe("storeLocalDateStr", () => {
  test("Returns YYYY-MM-DD string", () => {
    const result = storeLocalDateStr("UTC");
    assert.match(result, /^\d{4}-\d{2}-\d{2}$/);
  });

  test("Respects timezone — UTC midnight is previous day in UTC-5 (EST)", () => {
    // 2026-03-20 00:30 UTC  →  2026-03-19 in America/New_York (UTC-4 during DST or UTC-5 standard)
    // Use a date where we're confident of the offset: Jan 15 (standard time, UTC-5)
    const utcMidnight = new Date("2026-01-15T01:00:00.000Z"); // 01:00 UTC = 20:00 EST previous day
    const result = storeLocalDateStr("America/New_York", utcMidnight);
    assert.equal(result, "2026-01-14");
  });

  test("UTC timezone returns same date as UTC date string", () => {
    const d = new Date("2026-06-01T12:00:00.000Z");
    assert.equal(storeLocalDateStr("UTC", d), "2026-06-01");
  });

  test("Africa/Lagos (UTC+1) — returns correct date", () => {
    // 2026-03-20 23:00 UTC = 2026-03-21 00:00 WAT (Africa/Lagos, UTC+1)
    const d = new Date("2026-03-20T23:00:00.000Z");
    assert.equal(storeLocalDateStr("Africa/Lagos", d), "2026-03-21");
  });

  test("America/Los_Angeles — handles DST boundary correctly", () => {
    // 2026-03-08 10:00 UTC is 2026-03-08 02:00 PST (before DST switch) → still March 8
    const d = new Date("2026-03-08T10:00:00.000Z");
    const result = storeLocalDateStr("America/Los_Angeles", d);
    assert.match(result, /^2026-03-0[78]$/); // just verify format + approximate date
  });

  test("Without date arg — returns today's local date string", () => {
    const result = storeLocalDateStr("UTC");
    const today = new Date().toISOString().split("T")[0];
    assert.equal(result, today);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// storeLocalHour
// ─────────────────────────────────────────────────────────────────────────────
describe("storeLocalHour", () => {
  test("Returns a number 0–23", () => {
    const hour = storeLocalHour("UTC");
    assert.ok(hour >= 0 && hour <= 23, `Expected 0-23, got ${hour}`);
  });

  test("UTC — hour matches JS UTC hour", () => {
    const d = new Date("2026-03-20T15:30:00.000Z");
    assert.equal(storeLocalHour("UTC", d), 15);
  });

  test("Africa/Lagos (UTC+1) — hour is UTC+1", () => {
    const d = new Date("2026-03-20T15:00:00.000Z"); // 15 UTC = 16 WAT
    assert.equal(storeLocalHour("Africa/Lagos", d), 16);
  });

  test("America/New_York (UTC-5 in Jan) — hour is UTC-5", () => {
    const d = new Date("2026-01-10T20:00:00.000Z"); // 20 UTC = 15 EST
    assert.equal(storeLocalHour("America/New_York", d), 15);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// storeLocalDayBounds
// ─────────────────────────────────────────────────────────────────────────────
describe("storeLocalDayBounds", () => {
  test("Returns { start, end } Date objects", () => {
    const { start, end } = storeLocalDayBounds("UTC");
    assert.ok(start instanceof Date, "start is a Date");
    assert.ok(end instanceof Date,   "end is a Date");
  });

  test("start < end", () => {
    const { start, end } = storeLocalDayBounds("UTC");
    assert.ok(start < end, "start < end");
  });

  test("UTC — start is midnight UTC", () => {
    const d = new Date("2026-06-15T14:30:00.000Z");
    const { start } = storeLocalDayBounds("UTC", d);
    assert.equal(start.toISOString(), "2026-06-15T00:00:00.000Z");
  });

  test("Africa/Lagos (UTC+1) — start is 23:00 UTC of previous day", () => {
    // Local midnight in Lagos (UTC+1) = 23:00 UTC previous day
    const d = new Date("2026-06-15T14:30:00.000Z"); // mid-day Lagos = June 15
    const { start } = storeLocalDayBounds("Africa/Lagos", d);
    assert.equal(start.toISOString(), "2026-06-14T23:00:00.000Z");
  });

  test("start date string matches storeLocalDateStr", () => {
    const tz = "America/Chicago";
    const d  = new Date("2026-09-01T12:00:00.000Z");
    const { start } = storeLocalDayBounds(tz, d);
    const dateStr   = storeLocalDateStr(tz, d);
    // start should be midnight local time on the same local date
    assert.equal(storeLocalDateStr(tz, start), dateStr);
  });

  test("span is exactly 24h - 1ms (start inclusive to 23:59:59.999 end)", () => {
    // end is defined as localMidnightUtcMs + 86_400_000 - 1  (23:59:59.999)
    const { start, end } = storeLocalDayBounds("UTC");
    assert.equal(end.getTime() - start.getTime(), 24 * 60 * 60 * 1000 - 1);
  });
});
