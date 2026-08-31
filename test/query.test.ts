import test from "node:test";
import assert from "node:assert/strict";
import { parseUsageQuery } from "../src/query.ts";

const now = new Date(2026, 7, 30, 17, 0, 0);

test("query parser supports help and inclusive date ranges", () => {
  assert.deepEqual(parseUsageQuery("help", now), { kind: "help" });
  assert.deepEqual(parseUsageQuery("range 2026-08-01 2026-08-15", now), {
    kind: "range",
    start: new Date(2026, 7, 1).getTime(),
    endExclusive: new Date(2026, 7, 16).getTime(),
    label: "2026-08-01 – 2026-08-15",
  });
});

test("trend query supports defaults, counts, and explicit date ranges", () => {
  assert.deepEqual(parseUsageQuery("daily", now), {
    kind: "trend",
    bucket: "day",
    start: new Date(2026, 7, 24).getTime(),
    endExclusive: new Date(2026, 7, 31).getTime(),
  });
  assert.deepEqual(parseUsageQuery("weekly 2", now), {
    kind: "trend",
    bucket: "week",
    start: new Date(2026, 7, 17).getTime(),
    endExclusive: new Date(2026, 7, 31).getTime(),
  });
  assert.deepEqual(parseUsageQuery("monthly 2026-01-15 2026-03-10", now), {
    kind: "trend",
    bucket: "month",
    start: new Date(2026, 0, 15).getTime(),
    endExclusive: new Date(2026, 2, 11).getTime(),
  });
});

test("count trends include the current partial week or month through today", () => {
  const midweek = new Date(2026, 7, 20, 17);
  assert.deepEqual(parseUsageQuery("weekly 3", midweek), {
    kind: "trend",
    bucket: "week",
    start: new Date(2026, 7, 3).getTime(),
    endExclusive: new Date(2026, 7, 21).getTime(),
  });

  const monthEnd = new Date(2026, 2, 31, 17);
  assert.deepEqual(parseUsageQuery("monthly 2", monthEnd), {
    kind: "trend",
    bucket: "month",
    start: new Date(2026, 1, 1).getTime(),
    endExclusive: new Date(2026, 3, 1).getTime(),
  });
});

test("query parser rejects invalid dates, counts, and unsupported commands", () => {
  assert.throws(
    () => parseUsageQuery("range 2026-02-30 2026-03-01", now),
    /Invalid date/,
  );
  assert.throws(() => parseUsageQuery("daily 366", now), /between 1 and 365/);
  assert.throws(
    () => parseUsageQuery("weekly 2026-09-01 2026-08-01", now),
    /before or equal/,
  );
  assert.throws(() => parseUsageQuery("unknown", now), /Unknown usage command/);
});
