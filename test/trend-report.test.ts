import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG } from "../src/config.ts";
import {
  missingMetricFields,
  renderHelpMarkdown,
  renderSummaryMarkdown,
  renderTrendMarkdown,
} from "../src/report.ts";
import type { UsageRecord } from "../src/types.ts";

function record(
  id: string,
  date: Date,
  tokens: number,
  cost: number,
  model = "model",
): UsageRecord {
  return {
    id,
    timestamp: date.getTime(),
    sessionId: "s1",
    cwd: "/project",
    project: "project",
    source: "assistant",
    provider: "test",
    model,
    usage: {
      input: tokens,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: tokens,
      cost: {
        input: cost,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        total: cost,
      },
    },
  };
}

const records = [
  record("one", new Date(2026, 7, 28, 12), 1000, 1),
  record("two", new Date(2026, 7, 30, 12), 2000, 2, "other"),
];

test("daily trend includes empty dates and marks the current bucket", () => {
  const markdown = renderTrendMarkdown({
    records,
    bucket: "day",
    start: new Date(2026, 7, 28).getTime(),
    endExclusive: new Date(2026, 7, 31).getTime(),
    metrics: DEFAULT_CONFIG.metrics,
    now: new Date(2026, 7, 30, 17),
    partial: false,
  });

  assert.match(markdown, /\| 2026-08-28 \| 1K \| \$1\.00 \|/);
  assert.match(markdown, /\| 2026-08-29 \| 0 \| \$0\.00 \|/);
  assert.match(markdown, /\| 2026-08-30 · Current \| 2K \| \$2\.00 \|/);
});

test("range report shows total metrics and a model breakdown", () => {
  const markdown = renderSummaryMarkdown({
    records,
    start: new Date(2026, 7, 28).getTime(),
    endExclusive: new Date(2026, 7, 31).getTime(),
    label: "2026-08-28 – 2026-08-30",
    metrics: DEFAULT_CONFIG.metrics,
    partial: false,
  });

  assert.match(markdown, /## Usage · 2026-08-28 – 2026-08-30/);
  assert.match(markdown, /\*\*3K tokens · \$3\.00\*\*/);
  assert.match(markdown, /`test\/other`/);
});

test("missing or non-numeric configured fields render as n/a and are reported", () => {
  const metrics = [
    {
      path: "timing.durationMs",
      label: "Duration",
      format: "number" as const,
    },
  ];
  const markdown = renderSummaryMarkdown({
    records,
    start: new Date(2026, 7, 28).getTime(),
    endExclusive: new Date(2026, 7, 31).getTime(),
    label: "missing",
    metrics,
    partial: false,
  });
  assert.match(markdown, /\*\*n\/a\*\*/);
  assert.deepEqual(missingMetricFields(records, metrics), [
    "timing.durationMs",
  ]);
});

test("help is a concise command reference that links to full documentation", () => {
  const help = renderHelpMarkdown();
  assert.match(help, /\/usage show <path>/);
  assert.match(help, /daily\|weekly\|monthly \[range\]/);
  assert.match(help, /github\.com\/LelouchHe\/pi-usage/);
  assert.doesNotMatch(help, /usage\.cacheWrite1h/);
});
