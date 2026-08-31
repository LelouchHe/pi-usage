import { aggregateRange, metricValue } from "./aggregate.ts";
import { bucketStart, type TrendBucket } from "./query.ts";
import type { MetricConfig, MetricTotals, UsageRecord } from "./types.ts";

export function renderSessionMarkdown(options: {
  records: UsageRecord[];
  sessionId: string;
  metrics: MetricConfig[];
  partial: boolean;
}): string {
  const records = options.records.filter(
    (record) => record.sessionId === options.sessionId,
  );
  const totals = aggregateRange(records, null, null, "", true);
  const lines = [
    "## Usage · Current session",
    "",
    `**${formatMetrics(totals.all, options.metrics)}**`,
    "",
    renderModelTable(totals.models, options.metrics),
  ];
  appendPartial(lines, options.partial);
  return lines.join("\n");
}

export function renderSummaryMarkdown(options: {
  records: UsageRecord[];
  start: number | null;
  endExclusive: number | null;
  label: string;
  metrics: MetricConfig[];
  partial: boolean;
}): string {
  const totals = aggregateRange(
    options.records,
    options.start,
    options.endExclusive,
  );
  const lines = [
    `## Usage · ${options.label}`,
    "",
    `**${formatMetrics(totals.all, options.metrics)}**`,
    "",
    renderModelTable(totals.models, options.metrics),
  ];
  appendPartial(lines, options.partial);
  return lines.join("\n");
}

export function renderTrendMarkdown(options: {
  records: UsageRecord[];
  bucket: TrendBucket;
  start: number;
  endExclusive: number;
  metrics: MetricConfig[];
  now?: Date;
  partial: boolean;
}): string {
  const now = options.now ?? new Date();
  const rows: string[][] = [];
  const available = new Set(
    options.metrics
      .filter(
        (metric) =>
          !missingMetricFields(options.records, [metric]).includes(metric.path),
      )
      .map((metric) => metric.path),
  );
  let cursor = bucketStart(new Date(options.start), options.bucket);

  while (cursor < options.endExclusive) {
    const next = nextBucket(cursor, options.bucket);
    const rangeStart = Math.max(cursor, options.start);
    const rangeEnd = Math.min(next, options.endExclusive);
    const totals = aggregateRange(options.records, rangeStart, rangeEnd).all;
    rows.push([
      bucketLabel(
        cursor,
        next,
        options.bucket,
        options.start,
        options.endExclusive,
        now,
      ),
      ...options.metrics.map((metric) =>
        formatMetric(
          totals[metric.path] ?? (available.has(metric.path) ? 0 : undefined),
          metric.format,
        ),
      ),
    ]);
    cursor = next;
  }

  const title =
    options.bucket === "day"
      ? "Daily"
      : options.bucket === "week"
        ? "Weekly"
        : "Monthly";
  const lines = [
    `## Usage · ${title}`,
    "",
    tableRow(["Period", ...options.metrics.map((metric) => metric.label)]),
    `|${["---", ...options.metrics.map(() => "---:")].join("|")}|`,
    ...rows.map(tableRow),
  ];
  appendPartial(lines, options.partial);
  return lines.join("\n");
}

export function missingMetricFields(
  records: UsageRecord[],
  metrics: MetricConfig[],
  includeRollups = false,
): string[] {
  const counted = includeRollups
    ? records
    : records.filter((record) => record.source !== "tool_result_aggregate");
  return metrics
    .filter(
      (metric) =>
        !counted.some((record) => metricValue(record, metric.path) !== null),
    )
    .map((metric) => metric.path);
}

export function renderHelpMarkdown(): string {
  return `## Pi Usage

### Commands

- \`/usage\` — current session, including tool and subagent rollups
- \`/usage help\` — this reference
- \`/usage show <path> [path...]\` — current session with temporary metrics
- \`/usage today|all|7d|2w|3m\` — global totals and models
- \`/usage <start> <end>\` — global totals and models for an inclusive date range
- \`/usage daily|weekly|monthly <range>\` — global trend using the same range syntax

Ranges use aligned local calendar days, Monday-based weeks, and calendar months. \`m\` means months. Explicit dates use \`YYYY-MM-DD\` with inclusive endpoints. Current and edge buckets can be partial.

### Configuration

Path: \`~/.pi/agent/pi-usage/config.json\`

Configuration contains only \`metrics\`, each with \`path\`, \`label\`, and \`format\` (\`tokens|usd|number\`).

| Field | Meaning |
|---|---|
| \`usage.input\` | Uncached input tokens |
| \`usage.output\` | Output tokens, including reasoning |
| \`usage.cacheRead\` | Tokens read from prompt cache |
| \`usage.cacheWrite\` | Tokens written to prompt cache |
| \`usage.cacheWrite1h\` | One-hour cache writes; subset of \`usage.cacheWrite\` |
| \`usage.reasoning\` | Reasoning tokens; subset of \`usage.output\` |
| \`usage.totalTokens\` | Total reported by Pi |
| \`usage.cost.input\` | Estimated input cost |
| \`usage.cost.output\` | Estimated output cost |
| \`usage.cost.cacheRead\` | Estimated cache-read cost |
| \`usage.cost.cacheWrite\` | Estimated cache-write cost |
| \`usage.cost.total\` | Total estimated cost |

Any safe dot path to an arbitrary nested numeric field can be accumulated, including a future top-level object such as \`timing.durationMs\`. Missing or non-numeric values are skipped; a field absent from every stored record is reported as unavailable.

Metric formats: \`tokens\`, \`usd\`, \`number\`.`;
}

function renderModelTable(
  models: Array<{ key: string; values: MetricTotals }>,
  metrics: MetricConfig[],
): string {
  const header = ["Model", ...metrics.map((metric) => metric.label)];
  const align = ["---", ...metrics.map(() => "---:")];
  const rows = models.map((model) => [
    `\`${escapeTable(model.key)}\``,
    ...metrics.map((metric) =>
      formatMetric(model.values[metric.path], metric.format),
    ),
  ]);
  return [tableRow(header), `|${align.join("|")}|`, ...rows.map(tableRow)].join(
    "\n",
  );
}

function appendPartial(lines: string[], partial: boolean): void {
  if (partial)
    lines.push("", "> History import is running; totals are partial.");
}

function nextBucket(start: number, bucket: TrendBucket): number {
  const date = new Date(start);
  if (bucket === "day") date.setDate(date.getDate() + 1);
  else if (bucket === "week") date.setDate(date.getDate() + 7);
  else date.setMonth(date.getMonth() + 1);
  return date.getTime();
}

function bucketLabel(
  start: number,
  endExclusive: number,
  bucket: TrendBucket,
  queryStart: number,
  queryEndExclusive: number,
  now: Date,
): string {
  const startDate = new Date(start);
  const endDate = new Date(endExclusive);
  endDate.setDate(endDate.getDate() - 1);
  const base =
    bucket === "day"
      ? isoDate(startDate)
      : bucket === "week"
        ? `${isoDate(startDate)} – ${isoDate(endDate)}`
        : `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}`;
  const nowTime = now.getTime();
  if (nowTime >= start && nowTime < endExclusive) return `${base} · Current`;
  if (queryStart > start || queryEndExclusive < endExclusive)
    return `${base} · Partial`;
  return base;
}

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatMetrics(values: MetricTotals, metrics: MetricConfig[]): string {
  return metrics
    .map((metric) => {
      const unit = unitLabel(metric.format);
      const value = formatMetric(values[metric.path], metric.format);
      return `${value}${value === "n/a" || !unit ? "" : ` ${unit}`}`;
    })
    .join(" · ");
}

function formatMetric(
  value: number | undefined,
  format: MetricConfig["format"],
): string {
  if (value === undefined) return "n/a";
  if (format === "usd") return `$${value.toFixed(2)}`;
  if (format === "tokens") return compactNumber(value);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
    value,
  );
}

function unitLabel(format: MetricConfig["format"]): string {
  return format === "tokens" ? "tokens" : "";
}

function compactNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${trim(value / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `${trim(value / 1_000_000)}M`;
  if (abs >= 1_000) return `${trim(value / 1_000)}K`;
  return String(Math.round(value));
}

function trim(value: number): string {
  return value
    .toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*[1-9])0+$/, "$1");
}

function tableRow(values: string[]): string {
  return `| ${values.join(" | ")} |`;
}

function escapeTable(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("`", "\\`");
}
