import type { MetricConfig, UsageConfig } from "./types.ts";

export const DEFAULT_CONFIG: UsageConfig = {
  metrics: [
    { path: "usage.totalTokens", label: "Tokens", format: "tokens" },
    { path: "usage.cost.total", label: "Cost", format: "usd" },
  ],
};

const FORMATS = new Set(["tokens", "usd", "number"]);
const UNSAFE_PATH_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);
const TOKEN_PATHS = new Set([
  "usage.input",
  "usage.output",
  "usage.cacheRead",
  "usage.cacheWrite",
  "usage.cacheWrite1h",
  "usage.reasoning",
  "usage.totalTokens",
]);

export function parseConfig(value: unknown): UsageConfig {
  if (!value || typeof value !== "object")
    return structuredClone(DEFAULT_CONFIG);
  const raw = value as { metrics?: unknown };
  if (!Array.isArray(raw.metrics)) {
    throw new Error("Config must contain a metrics array");
  }

  const metrics = raw.metrics.map(parseMetric);
  if (metrics.length === 0) throw new Error("Config metrics cannot be empty");
  return { metrics };
}

export function parseMetric(value: unknown): MetricConfig {
  const item = value as Partial<MetricConfig>;
  if (typeof item.path !== "string" || !isSafeMetricPath(item.path)) {
    throw new Error(`Invalid metric field path: ${String(item.path)}`);
  }
  if (typeof item.label !== "string" || !item.label.trim())
    throw new Error("Metric label is required");
  if (!FORMATS.has(String(item.format)))
    throw new Error(`Unsupported metric format: ${String(item.format)}`);
  return {
    path: item.path,
    label: item.label.trim(),
    format: item.format as MetricConfig["format"],
  };
}

export function temporaryMetric(path: string): MetricConfig {
  if (!isSafeMetricPath(path)) {
    throw new Error(`Invalid metric field path: ${path}`);
  }
  return {
    path,
    label: path,
    format: path.startsWith("usage.cost.")
      ? "usd"
      : TOKEN_PATHS.has(path)
        ? "tokens"
        : "number",
  };
}

export function isSafeMetricPath(field: string): boolean {
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
