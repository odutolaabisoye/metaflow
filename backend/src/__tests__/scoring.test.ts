/**
 * MetaFlow Scoring Engine Unit Tests
 *
 * Uses Node.js built-in test runner (node --test) with the assert module.
 * Run with: npx tsx --test src/__tests__/scoring.test.ts
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  computeProductScore,
  computeScoreBreakdown,
  scoreToCategory,
  DEFAULT_BENCHMARKS,
  DEFAULT_THRESHOLDS,
} from "../jobs/scoring.js";

// ────────────────────────────────────────────────────────────────────────────
// computeProductScore
// ────────────────────────────────────────────────────────────────────────────

describe("computeProductScore", () => {
  test("1. Full score — all benchmarks exactly met → 100", () => {
    const score = computeProductScore({
      roas:           DEFAULT_BENCHMARKS.roasBenchmark,   // 5
      ctr:            DEFAULT_BENCHMARKS.ctrBenchmark,    // 0.03
      margin:         DEFAULT_BENCHMARKS.marginBenchmark, // 0.5
      inventoryLevel: DEFAULT_BENCHMARKS.inventoryBenchmark, // 10
    });
    assert.equal(score, 100);
  });

  test("2. Zero score (all metrics zero, inventory null) → 10 (neutral inventory pts)", () => {
    const score = computeProductScore({
      roas:           0,
      ctr:            0,
      margin:         0,
      inventoryLevel: null,
    });
    // roasScore=0, ctrScore=0, marginScore=0, inventoryScore=10 (null=neutral)
    assert.equal(score, 10);
  });

  test("3. Zero score with inventory=0 → 0", () => {
    const score = computeProductScore({
      roas:           0,
      ctr:            0,
      margin:         0,
      inventoryLevel: 0,
    });
    assert.equal(score, 0);
  });

  test("4. ROAS-only partial (half benchmark) contributes 17.5 pts from ROAS alone", () => {
    // ROAS = 2.5 (half of 5 benchmark) → (2.5/5)*35 = 17.5, rounded = 18
    // Other metrics are 0, inventory null (10 pts neutral) → total = 18 + 10 = 28
    const score = computeProductScore({
      roas:           DEFAULT_BENCHMARKS.roasBenchmark / 2,
      ctr:            0,
      margin:         0,
      inventoryLevel: null,
    });
    // roasScore = Math.round(17.5 + 0 + 0 + 10) = 28
    assert.equal(score, 28);
  });

  test("5. CTR above benchmark capped at max (20pts)", () => {
    // CTR far above benchmark should still give at most 20 pts contribution
    const score = computeProductScore({
      roas:           0,
      ctr:            DEFAULT_BENCHMARKS.ctrBenchmark * 100, // 100x over benchmark
      margin:         0,
      inventoryLevel: null,
    });
    // ctrScore capped at 20, inventoryScore=10 (null), rest 0 → 30
    assert.equal(score, 30);
  });

  test("6. Margin exactly at benchmark → 25pts from margin", () => {
    // Only margin at benchmark, rest zero, inventory null
    // marginScore=25, inventoryScore=10 → 35
    const score = computeProductScore({
      roas:           0,
      ctr:            0,
      margin:         DEFAULT_BENCHMARKS.marginBenchmark,
      inventoryLevel: null,
    });
    assert.equal(score, 35);
  });

  test("7. Inventory null → 10pts neutral (regardless of other metrics)", () => {
    const scoreWithNull = computeProductScore({
      roas: 0, ctr: 0, margin: 0,
      inventoryLevel: null,
    });
    // 0+0+0+10 = 10
    assert.equal(scoreWithNull, 10);
  });

  test("8. Custom benchmarks override defaults", () => {
    const customBenchmarks = {
      roasBenchmark:      10,   // double default
      ctrBenchmark:       0.06, // double default
      marginBenchmark:    1.0,  // double default
      inventoryBenchmark: 20,   // double default
    };
    // At default-benchmark values, with doubled benchmarks each metric is at 50%
    const score = computeProductScore(
      {
        roas:           5,    // half of 10 → 17.5 pts
        ctr:            0.03, // half of 0.06 → 10 pts
        margin:         0.5,  // half of 1.0 → 12.5 pts
        inventoryLevel: 10,   // half of 20 → 10 pts
      },
      customBenchmarks
    );
    // roasScore=17.5, ctrScore=10, marginScore=12.5, inventoryScore=10 → Math.round(50)=50
    assert.equal(score, 50);
  });

  test("9. scoreToCategory defaults: 80→SCALE, 60→TEST, 30→RISK, 20→KILL", () => {
    assert.equal(scoreToCategory(80, DEFAULT_THRESHOLDS), "SCALE");
    assert.equal(scoreToCategory(60, DEFAULT_THRESHOLDS), "TEST");
    assert.equal(scoreToCategory(30, DEFAULT_THRESHOLDS), "RISK");
    assert.equal(scoreToCategory(20, DEFAULT_THRESHOLDS), "KILL");
  });

  test("10. scoreToCategory with custom thresholds", () => {
    const custom = { thresholdScale: 90, thresholdTest: 60, thresholdKill: 30 };
    assert.equal(scoreToCategory(95, custom), "SCALE");
    assert.equal(scoreToCategory(75, custom), "TEST");
    assert.equal(scoreToCategory(40, custom), "RISK");
    assert.equal(scoreToCategory(15, custom), "KILL");
  });

  test("11. Edge case: negative metrics — Math.min with negative/zero still clamps at 0 pts", () => {
    // Negative ROAS: (-5/5) = -1, Math.min(-1, 1) = -1 → -35 pts
    // But the scoring formula uses Math.min(metric/benchmark, 1) * weight.
    // Negative metrics can give negative component scores.
    // Products should not have negative metrics in practice, but let's verify behavior.
    const score = computeProductScore({
      roas:           -5,
      ctr:            -0.03,
      margin:         -0.5,
      inventoryLevel: null,
    });
    // Math.min(-1, 1)*35 = -35, etc. → total would be very negative; Math.round(-35-20-25+10) = -70
    // The function does NOT clamp negative outputs — this test documents the current behavior.
    assert.equal(typeof score, "number");
    assert.ok(score < 0, "Negative metrics produce a negative score (no floor clamping)");
  });

  test("12. Real-world example: ROAS=3, CTR=2%, margin=40%, inventory=5 with benchmark ROAS=5", () => {
    // roasScore   = Math.min(3/5, 1)*35   = 0.6*35 = 21
    // ctrScore    = Math.min(0.02/0.03,1)*20 = 0.667*20 ≈ 13.33
    // marginScore = Math.min(0.4/0.5, 1)*25  = 0.8*25 = 20
    // inventoryScore = (5/10)*20 = 10
    // total = Math.round(21 + 13.33 + 20 + 10) = Math.round(64.33) = 64
    const score = computeProductScore(
      { roas: 3, ctr: 0.02, margin: 0.4, inventoryLevel: 5 },
      DEFAULT_BENCHMARKS
    );
    assert.equal(score, 64);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// scoreToCategory boundary conditions
// ────────────────────────────────────────────────────────────────────────────

describe("scoreToCategory boundary conditions", () => {
  test("Exactly at thresholdScale → SCALE", () => {
    assert.equal(scoreToCategory(DEFAULT_THRESHOLDS.thresholdScale, DEFAULT_THRESHOLDS), "SCALE");
  });

  test("One below thresholdScale → TEST", () => {
    assert.equal(scoreToCategory(DEFAULT_THRESHOLDS.thresholdScale - 1, DEFAULT_THRESHOLDS), "TEST");
  });

  test("Exactly at thresholdTest → TEST", () => {
    assert.equal(scoreToCategory(DEFAULT_THRESHOLDS.thresholdTest, DEFAULT_THRESHOLDS), "TEST");
  });

  test("One below thresholdTest → RISK", () => {
    assert.equal(scoreToCategory(DEFAULT_THRESHOLDS.thresholdTest - 1, DEFAULT_THRESHOLDS), "RISK");
  });

  test("Exactly at thresholdKill → RISK", () => {
    assert.equal(scoreToCategory(DEFAULT_THRESHOLDS.thresholdKill, DEFAULT_THRESHOLDS), "RISK");
  });

  test("One below thresholdKill → KILL", () => {
    assert.equal(scoreToCategory(DEFAULT_THRESHOLDS.thresholdKill - 1, DEFAULT_THRESHOLDS), "KILL");
  });

  test("Score 0 → KILL", () => {
    assert.equal(scoreToCategory(0, DEFAULT_THRESHOLDS), "KILL");
  });

  test("Score 100 → SCALE", () => {
    assert.equal(scoreToCategory(100, DEFAULT_THRESHOLDS), "SCALE");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// computeScoreBreakdown
// ────────────────────────────────────────────────────────────────────────────

describe("computeScoreBreakdown", () => {
  test("Returns 4 factors", () => {
    const breakdown = computeScoreBreakdown({
      roas: 5, ctr: 0.03, margin: 0.5, inventoryLevel: 10
    });
    assert.equal(breakdown.length, 4);
  });

  test("Factor labels are correct", () => {
    const breakdown = computeScoreBreakdown({
      roas: 5, ctr: 0.03, margin: 0.5, inventoryLevel: 10
    });
    const labels = breakdown.map(f => f.label);
    assert.ok(labels.some(l => l.includes("ROAS")));
    assert.ok(labels.some(l => l.includes("CTR")));
    assert.ok(labels.some(l => l.includes("Margin")));
    assert.ok(labels.some(l => l.includes("Inventory")));
  });

  test("Max values sum to 100 (35+20+25+20)", () => {
    const breakdown = computeScoreBreakdown({
      roas: 5, ctr: 0.03, margin: 0.5, inventoryLevel: 10
    });
    const totalMax = breakdown.reduce((sum, f) => sum + f.max, 0);
    assert.equal(totalMax, 100);
  });

  test("All benchmarks met → contributions sum to 100", () => {
    const breakdown = computeScoreBreakdown({
      roas:           DEFAULT_BENCHMARKS.roasBenchmark,
      ctr:            DEFAULT_BENCHMARKS.ctrBenchmark,
      margin:         DEFAULT_BENCHMARKS.marginBenchmark,
      inventoryLevel: DEFAULT_BENCHMARKS.inventoryBenchmark
    });
    const total = breakdown.reduce((sum, f) => sum + f.contribution, 0);
    assert.equal(total, 100);
  });

  test("inventoryLevel null → Inventory contribution is 10 (neutral)", () => {
    const breakdown = computeScoreBreakdown({
      roas: 0, ctr: 0, margin: 0, inventoryLevel: null
    });
    const inv = breakdown.find(f => f.label.includes("Inventory"))!;
    assert.equal(inv.contribution, 10);
    assert.ok(inv.detail.includes("neutral"));
  });

  test("inventoryLevel 0 → Inventory contribution is 0", () => {
    const breakdown = computeScoreBreakdown({
      roas: 0, ctr: 0, margin: 0, inventoryLevel: 0
    });
    const inv = breakdown.find(f => f.label.includes("Inventory"))!;
    assert.equal(inv.contribution, 0);
  });

  test("ROAS at benchmark → ROAS contribution is 35", () => {
    const breakdown = computeScoreBreakdown({
      roas: DEFAULT_BENCHMARKS.roasBenchmark,
      ctr: 0, margin: 0, inventoryLevel: null
    });
    const roas = breakdown.find(f => f.label.includes("ROAS"))!;
    assert.equal(roas.contribution, 35);
  });

  test("CTR above benchmark → capped at 20 (max)", () => {
    const breakdown = computeScoreBreakdown({
      roas: 0,
      ctr: DEFAULT_BENCHMARKS.ctrBenchmark * 100,
      margin: 0, inventoryLevel: null
    });
    const ctr = breakdown.find(f => f.label.includes("CTR"))!;
    assert.equal(ctr.contribution, 20);
    assert.equal(ctr.max, 20);
  });

  test("Custom benchmarks override defaults", () => {
    const breakdown = computeScoreBreakdown(
      { roas: 5, ctr: 0.03, margin: 0.5, inventoryLevel: 10 },
      {
        roasBenchmark:      10,  // double default → each metric at 50%
        ctrBenchmark:       0.06,
        marginBenchmark:    1.0,
        inventoryBenchmark: 20
      }
    );
    // ROAS: min(5/10,1)*35 = 17.5
    const roas = breakdown.find(f => f.label.includes("ROAS"))!;
    assert.equal(roas.contribution, 17.5);
    // Margin: min(0.5/1.0,1)*25 = 12.5
    const margin = breakdown.find(f => f.label.includes("Margin"))!;
    assert.equal(margin.contribution, 12.5);
  });

  test("breakdown contributions align with computeProductScore total", () => {
    const metrics = {
      roas: 3, ctr: 0.02, margin: 0.4, inventoryLevel: 5
    };
    const score     = computeProductScore(metrics);
    const breakdown = computeScoreBreakdown(metrics);
    const brkTotal  = Math.round(breakdown.reduce((s, f) => s + f.contribution, 0));
    assert.equal(brkTotal, score, "breakdown sum should equal computeProductScore");
  });

  test("Each factor has label, contribution, max, detail properties", () => {
    const breakdown = computeScoreBreakdown({
      roas: 5, ctr: 0.03, margin: 0.5, inventoryLevel: 10
    });
    for (const factor of breakdown) {
      assert.ok(typeof factor.label        === "string",  `label should be string`);
      assert.ok(typeof factor.contribution === "number",  `contribution should be number`);
      assert.ok(typeof factor.max          === "number",  `max should be number`);
      assert.ok(typeof factor.detail       === "string",  `detail should be string`);
      assert.ok(factor.contribution >= 0,                 `contribution should be >= 0`);
      assert.ok(factor.contribution <= factor.max,        `contribution <= max`);
    }
  });
});
