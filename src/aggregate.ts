import type {
  MetricField,
  MetricTotals,
  PeriodKey,
  UsageRecord,
} from "./types.ts";

export interface ModelTotals {
  key: string;
  values: MetricTotals;
}

export interface PeriodTotals {
  all: MetricTotals;
  currentProject: MetricTotals;
  models: ModelTotals[];
}

export function aggregatePeriod(
  records: UsageRecord[],
  period: PeriodKey,
  currentProject: string,
  now = new Date(),
): PeriodTotals {
  const start = periodStart(period, now);
  return aggregateRange(records, start, null, currentProject);
}

export function aggregateRange(
  records: UsageRecord[],
  start: number | null,
  endExclusive: number | null,
  currentProject = "",
  includeRollups = false,
): PeriodTotals {
  const selected = records.filter(
    (record) =>
      (includeRollups || record.source !== "tool_result_aggregate") &&
      (start === null || record.timestamp >= start) &&
      (endExclusive === null || record.timestamp < endExclusive),
  );
  const models = new Map<string, MetricTotals>();

  for (const record of selected) {
    const key = `${record.provider}/${record.model}`;
    const totals = models.get(key) ?? {};
    addRecord(totals, record);
    models.set(key, totals);
  }

  return {
    all: sumRecords(selected),
    currentProject: sumRecords(
      selected.filter((record) => record.cwd === currentProject),
    ),
    models: [...models.entries()]
      .map(([key, values]) => ({ key, values }))
      .sort(
        (a, b) =>
          sortValue(b.values) - sortValue(a.values) ||
          a.key.localeCompare(b.key),
      ),
  };
}

export function metricValue(
  record: UsageRecord,
  field: MetricField,
): number | null {
  let value: unknown = record;
  for (const part of field.split(".")) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    value = (value as Record<string, unknown>)[part];
  }
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sumRecords(records: UsageRecord[]): MetricTotals {
  const totals: MetricTotals = {};
  for (const record of records) addRecord(totals, record);
  return totals;
}

function addRecord(totals: MetricTotals, record: UsageRecord): void {
  addNumericLeaves(totals, record as unknown as Record<string, unknown>);
}

function addNumericLeaves(
  totals: MetricTotals,
  value: Record<string, unknown>,
  prefix = "",
): void {
  for (const [key, child] of Object.entries(value)) {
    const field = prefix ? `${prefix}.${key}` : key;
    if (typeof child === "number" && Number.isFinite(child)) {
      totals[field] = (totals[field] ?? 0) + child;
    } else if (child && typeof child === "object" && !Array.isArray(child)) {
      addNumericLeaves(totals, child as Record<string, unknown>, field);
    }
  }
}

function sortValue(values: MetricTotals): number {
  return values["usage.cost.total"] ?? values["usage.totalTokens"] ?? 0;
}

function periodStart(period: PeriodKey, now: Date): number | null {
  if (period === "all") return null;
  if (period === "today")
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (period === "month")
    return new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  return start.getTime();
}
