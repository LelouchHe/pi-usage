import type { MetricConfig, PeriodConfig, UsageConfig } from "./types.ts";

export const DEFAULT_CONFIG: UsageConfig = {
  periods: [
    { key: "today", name: "Today", currentProject: true, groupByModel: true },
    { key: "all", name: "All time", currentProject: false, groupByModel: true },
  ],
  metrics: [
    { field: "usage.totalTokens", name: "Tokens", unit: "tokens" },
    { field: "usage.cost.total", name: "Cost", unit: "usd" },
  ],
};

const PERIODS = new Set(["today", "week", "month", "all"]);
const UNITS = new Set(["tokens", "usd", "number"]);
const UNSAFE_PATH_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

export function parseConfig(value: unknown): UsageConfig {
  if (!value || typeof value !== "object")
    return structuredClone(DEFAULT_CONFIG);
  const raw = value as { periods?: unknown; metrics?: unknown };
  if (!Array.isArray(raw.periods) || !Array.isArray(raw.metrics)) {
    throw new Error("Config must contain periods and metrics arrays");
  }

  const periods = raw.periods.map(parsePeriod);
  const metrics = raw.metrics.map(parseMetric);
  if (periods.length === 0 || metrics.length === 0)
    throw new Error("Config periods and metrics cannot be empty");
  return { periods, metrics };
}

function parsePeriod(value: unknown): PeriodConfig {
  const item = value as Partial<PeriodConfig>;
  if (!PERIODS.has(String(item.key)))
    throw new Error(`Unsupported period: ${String(item.key)}`);
  if (typeof item.name !== "string" || !item.name.trim())
    throw new Error("Period name is required");
  return {
    key: item.key as PeriodConfig["key"],
    name: item.name.trim(),
    currentProject: item.currentProject === true,
    groupByModel: item.groupByModel === true,
  };
}

function parseMetric(value: unknown): MetricConfig {
  const item = value as Partial<MetricConfig>;
  if (typeof item.field !== "string" || !isSafeFieldPath(item.field)) {
    throw new Error(`Invalid metric field path: ${String(item.field)}`);
  }
  if (typeof item.name !== "string" || !item.name.trim())
    throw new Error("Metric name is required");
  if (!UNITS.has(String(item.unit)))
    throw new Error(`Unsupported metric unit: ${String(item.unit)}`);
  return {
    field: item.field,
    name: item.name.trim(),
    unit: item.unit as MetricConfig["unit"],
  };
}

function isSafeFieldPath(field: string): boolean {
  const segments = field.split(".");
  return (
    segments.length > 0 &&
    segments.every(
      (segment) =>
        segment.length > 0 &&
        !/\s/.test(segment) &&
        !UNSAFE_PATH_SEGMENTS.has(segment),
    )
  );
}
