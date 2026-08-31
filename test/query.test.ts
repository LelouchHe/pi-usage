import test from "node:test";
import assert from "node:assert/strict";
import { parseUsageQuery } from "../src/query.ts";

const now = new Date(2026, 7, 30, 17, 0, 0);

test("empty query selects the current session", () => {
  assert.deepEqual(parseUsageQuery("", now), { kind: "session" });
});

test("summary query supports today, all, aligned durations, and inclusive dates", () => {
  assert.deepEqual(parseUsageQuery("today", now), {
    kind: "summary",
    start: new Date(2026, 7, 30).getTime(),
    endExclusive: new Date(2026, 7, 31).getTime(),
    label: "Today",
  });
  assert.deepEqual(parseUsageQuery("all", now), {
    kind: "summary",
    start: null,
    endExclusive: null,
    label: "All time",
  });
  assert.deepEqual(parseUsageQuery("2w", now), {
    kind: "summary",
    start: new Date(2026, 7, 17).getTime(),
    endExclusive: new Date(2026, 7, 31).getTime(),
    label: "2w",
  });
  assert.deepEqual(parseUsageQuery("3m", now), {
    kind: "summary",
    start: new Date(2026, 5, 1).getTime(),
    endExclusive: new Date(2026, 7, 31).getTime(),
    label: "3m",
  });
  assert.deepEqual(parseUsageQuery("2026-08-01 2026-08-15", now), {
    kind: "summary",
    start: new Date(2026, 7, 1).getTime(),
    endExclusive: new Date(2026, 7, 16).getTime(),
    label: "2026-08-01 – 2026-08-15",
  });
});

test("trend query uses a named bucket and the same range syntax", () => {
  assert.deepEqual(parseUsageQuery("daily 7d", now), {
    kind: "trend",
    bucket: "day",
    start: new Date(2026, 7, 24).getTime(),
    endExclusive: new Date(2026, 7, 31).getTime(),
  });
  assert.deepEqual(parseUsageQuery("weekly 3m", now), {
    kind: "trend",
    bucket: "week",
    start: new Date(2026, 5, 1).getTime(),
    endExclusive: new Date(2026, 7, 31).getTime(),
  });
  // Bare counts default to the bucket unit.
  assert.deepEqual(parseUsageQuery("daily 7", now), {
    kind: "trend",
    bucket: "day",
    start: new Date(2026, 7, 24).getTime(),
    endExclusive: new Date(2026, 7, 31).getTime(),
  });
  assert.deepEqual(parseUsageQuery("weekly 4", now), {
    kind: "trend",
    bucket: "week",
    start: new Date(2026, 7, 3).getTime(),
    endExclusive: new Date(2026, 7, 31).getTime(),
  });
  assert.deepEqual(parseUsageQuery("monthly 6", now), {
    kind: "trend",
    bucket: "month",
    start: new Date(2026, 2, 1).getTime(),
    endExclusive: new Date(2026, 7, 31).getTime(),
  });
});

test("trend query falls back to sensible default ranges", () => {
  assert.deepEqual(parseUsageQuery("daily", now), {
    kind: "trend",
    bucket: "day",
    start: new Date(2026, 7, 24).getTime(),
    endExclusive: new Date(2026, 7, 31).getTime(),
  });
  assert.deepEqual(parseUsageQuery("weekly", now), {
    kind: "trend",
    bucket: "week",
    start: new Date(2026, 7, 3).getTime(),
    endExclusive: new Date(2026, 7, 31).getTime(),
  });
  assert.deepEqual(parseUsageQuery("monthly", now), {
    kind: "trend",
    bucket: "month",
    start: new Date(2026, 2, 1).getTime(),
    endExclusive: new Date(2026, 7, 31).getTime(),
  });
  assert.deepEqual(parseUsageQuery("monthly 2026-01-15 2026-03-10", now), {
    kind: "trend",
    bucket: "month",
    start: new Date(2026, 0, 15).getTime(),
    endExclusive: new Date(2026, 2, 11).getTime(),
  });
});

test("show query accepts one or more temporary metric paths", () => {
  assert.deepEqual(parseUsageQuery("show usage.input usage.cost.input", now), {
    kind: "show",
    paths: ["usage.input", "usage.cost.input"],
  });
});

test("query parser rejects malformed ranges and missing trend windows", () => {
  assert.throws(
    () => parseUsageQuery("2026-02-30 2026-03-01", now),
    /Invalid date/,
  );
  assert.throws(() => parseUsageQuery("0d", now), /positive/);
  assert.throws(
    () => parseUsageQuery("daily all", now),
    /does not support an unbounded range/,
  );
  assert.throws(() => parseUsageQuery("unknown", now), /Unknown usage range/);
});
