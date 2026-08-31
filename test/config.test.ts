import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG, parseConfig, temporaryMetric } from "../src/config.ts";

test("default config contains only token and cost metrics", () => {
  assert.deepEqual(DEFAULT_CONFIG, {
    metrics: [
      { path: "usage.totalTokens", label: "Tokens", format: "tokens" },
      { path: "usage.cost.total", label: "Cost", format: "usd" },
    ],
  });
});

test("config accepts future numeric paths without a package update", () => {
  const config = parseConfig({
    metrics: [
      { path: "usage.someFutureMetric", label: "Future", format: "number" },
      { path: "timing.durationMs", label: "Duration", format: "number" },
    ],
  });
  assert.deepEqual(
    config.metrics.map((metric) => metric.path),
    ["usage.someFutureMetric", "timing.durationMs"],
  );
});

test("temporary metrics use the full path as label and infer known formats", () => {
  assert.deepEqual(temporaryMetric("usage.input"), {
    path: "usage.input",
    label: "usage.input",
    format: "tokens",
  });
  assert.deepEqual(temporaryMetric("usage.cost.input"), {
    path: "usage.cost.input",
    label: "usage.cost.input",
    format: "usd",
  });
  assert.equal(temporaryMetric("timing.durationMs").format, "number");
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
          metrics: [{ path, label: "Bad", format: "number" }],
        }),
      /field path/,
    );
  }
});
