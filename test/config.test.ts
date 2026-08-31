import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG, parseConfig } from "../src/config.ts";

test("default config reports today and all time with additive token and cost fields", () => {
  assert.deepEqual(DEFAULT_CONFIG.periods, [
    { key: "today", name: "Today", currentProject: true, groupByModel: true },
    { key: "all", name: "All time", currentProject: false, groupByModel: true },
  ]);
  assert.deepEqual(DEFAULT_CONFIG.metrics, [
    { field: "usage.totalTokens", name: "Tokens", unit: "tokens" },
    { field: "usage.cost.total", name: "Cost", unit: "usd" },
  ]);
});

test("config accepts future numeric usage paths without a package update", () => {
  const config = parseConfig({
    periods: DEFAULT_CONFIG.periods,
    metrics: [
      { field: "usage.someFutureMetric", name: "Future", unit: "number" },
    ],
  });
  assert.equal(config.metrics[0]?.field, "usage.someFutureMetric");
});

test("config accepts metrics from future top-level objects", () => {
  const config = parseConfig({
    periods: DEFAULT_CONFIG.periods,
    metrics: [{ field: "timing.durationMs", name: "Duration", unit: "number" }],
  });
  assert.equal(config.metrics[0]?.field, "timing.durationMs");
});

test("config rejects malformed or unsafe field paths", () => {
  for (const field of [
    "",
    "usage..total",
    "usage.__proto__.value",
    "constructor.value",
  ]) {
    assert.throws(
      () =>
        parseConfig({
          periods: DEFAULT_CONFIG.periods,
          metrics: [{ field, name: "Bad", unit: "number" }],
        }),
      /field path/,
    );
  }
});
