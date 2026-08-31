import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG, parseConfig } from "../src/config.ts";

test("default config reports today and all time with additive token and cost fields", () => {
  assert.deepEqual(DEFAULT_CONFIG.sections, [
    { range: "today", current: true, models: true },
    { range: "all", current: false, models: true },
  ]);
  assert.deepEqual(DEFAULT_CONFIG.metrics, [
    { path: "usage.totalTokens", label: "Tokens", format: "tokens" },
    { path: "usage.cost.total", label: "Cost", format: "usd" },
  ]);
});

test("config accepts future numeric usage paths without a package update", () => {
  const config = parseConfig({
    sections: DEFAULT_CONFIG.sections,
    metrics: [
      { path: "usage.someFutureMetric", label: "Future", format: "number" },
    ],
  });
  assert.equal(config.metrics[0]?.path, "usage.someFutureMetric");
});

test("config accepts metrics from future top-level objects", () => {
  const config = parseConfig({
    sections: DEFAULT_CONFIG.sections,
    metrics: [
      { path: "timing.durationMs", label: "Duration", format: "number" },
    ],
  });
  assert.equal(config.metrics[0]?.path, "timing.durationMs");
});

test("config rejects malformed or unsafe field paths", () => {
  for (const path of [
    "",
    "usage..total",
    "usage.__proto__.value",
    "constructor.value",
  ]) {
    assert.throws(
      () =>
        parseConfig({
          sections: DEFAULT_CONFIG.sections,
          metrics: [{ path, label: "Bad", format: "number" }],
        }),
      /field path/,
    );
  }
});
