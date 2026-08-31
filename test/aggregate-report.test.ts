import test from "node:test";
import assert from "node:assert/strict";
import { aggregatePeriod, metricValue } from "../src/aggregate.ts";
import { DEFAULT_CONFIG } from "../src/config.ts";
import { renderSessionMarkdown, renderSummaryMarkdown } from "../src/report.ts";
import type { UsageRecord } from "../src/types.ts";

const currentProject = "/code/webagent/main";
const records: UsageRecord[] = [
  {
    id: "s1:a1:assistant",
    timestamp: Date.parse("2026-08-30T10:00:00Z"),
    sessionId: "s1",
    cwd: currentProject,
    project: "webagent/main",
    source: "assistant",
    provider: "github-copilot",
    model: "gpt-5.6-sol",
    usage: {
      input: 600000,
      output: 100000,
      cacheRead: 300000,
      cacheWrite: 0,
      totalTokens: 1000000,
      cost: { input: 1, output: 1, cacheRead: 0.2, cacheWrite: 0, total: 2.2 },
    },
  },
  {
    id: "s2:a2:assistant",
    timestamp: Date.parse("2026-08-30T12:00:00Z"),
    sessionId: "s2",
    cwd: "/code/other",
    project: "other",
    source: "assistant",
    provider: "github-copilot",
    model: "claude-haiku-4.5",
    usage: {
      input: 300000,
      output: 50000,
      cacheRead: 150000,
      cacheWrite: 0,
      totalTokens: 500000,
      cost: {
        input: 0.2,
        output: 0.2,
        cacheRead: 0.1,
        cacheWrite: 0,
        total: 0.5,
      },
    },
  },
  {
    id: "s2:t1:tool",
    timestamp: Date.parse("2026-08-30T12:01:00Z"),
    sessionId: "s1",
    cwd: currentProject,
    project: "webagent/main",
    source: "tool_result_aggregate",
    provider: "pi",
    model: "tool-aggregates",
    usage: {
      input: 900000,
      output: 50000,
      cacheRead: 50000,
      cacheWrite: 0,
      totalTokens: 1000000,
      cost: { input: 1, output: 1, cacheRead: 0.2, cacheWrite: 0, total: 2.2 },
    },
  },
  {
    id: "s3:a3:assistant",
    timestamp: Date.parse("2026-08-29T12:00:00Z"),
    sessionId: "s3",
    cwd: currentProject,
    project: "webagent/main",
    source: "assistant",
    provider: "github-copilot",
    model: "gpt-5.6-sol",
    usage: {
      input: 100000,
      output: 50000,
      cacheRead: 50000,
      cacheWrite: 0,
      totalTokens: 200000,
      cost: {
        input: 0.1,
        output: 0.1,
        cacheRead: 0.05,
        cacheWrite: 0,
        total: 0.25,
      },
    },
  },
];

const now = new Date("2026-08-30T18:00:00Z");

test("metric paths read arbitrary nested numeric values", () => {
  const record = { ...records[0], timing: { phases: { agentMs: 123 } } };
  assert.equal(metricValue(record, "timing.phases.agentMs"), 123);
  assert.equal(metricValue(record, "timing.missing"), null);
});

test("period aggregation separates current project and model totals", () => {
  const today = aggregatePeriod(records, "today", currentProject, now);
  assert.equal(today.all["usage.totalTokens"], 1500000);
  assert.equal(today.currentProject["usage.totalTokens"], 1000000);
  assert.equal(today.models.length, 2);
  assert.equal(today.models[0]?.key, "github-copilot/gpt-5.6-sol");

  const all = aggregatePeriod(records, "all", currentProject, now);
  assert.equal(all.all["usage.totalTokens"], 1700000);
});

test("session report includes tool rollups while global summary excludes them", () => {
  const session = renderSessionMarkdown({
    records,
    sessionId: "s1",
    metrics: DEFAULT_CONFIG.metrics,
    partial: false,
  });
  assert.match(session, /\*\*2M tokens · \$4\.40\*\*/);
  assert.match(session, /`pi\/tool-aggregates`/);

  const global = renderSummaryMarkdown({
    records,
    start: new Date("2026-08-30T00:00:00Z").getTime(),
    endExclusive: new Date("2026-08-31T00:00:00Z").getTime(),
    label: "Today",
    metrics: DEFAULT_CONFIG.metrics,
    partial: true,
  });
  assert.match(global, /\*\*1\.5M tokens · \$2\.70\*\*/);
  assert.doesNotMatch(global, /tool-aggregates/);
  assert.match(global, /totals are partial/);
});
