import type { MetricConfig, SectionConfig, UsageConfig } from "./types.ts";

export const DEFAULT_CONFIG: UsageConfig = {
  sections: [
    { range: "today", current: true, models: true },
    { range: "all", current: false, models: true },
  ],
  metrics: [
    { path: "usage.totalTokens", label: "Tokens", format: "tokens" },
    { path: "usage.cost.total", label: "Cost", format: "usd" },
  ],
};

const RANGES = new Set(["today", "week", "month", "all"]);
const FORMATS = new Set(["tokens", "usd", "number"]);
const UNSAFE_PATH_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

export function parseConfig(value: unknown): UsageConfig {
  if (!value || typeof value !== "object")
    return structuredClone(DEFAULT_CONFIG);
  const raw = value as { sections?: unknown; metrics?: unknown };
  if (!Array.isArray(raw.sections) || !Array.isArray(raw.metrics)) {
    throw new Error("Config must contain sections and metrics arrays");
  }

  const sections = raw.sections.map(parseSection);
  const metrics = raw.metrics.map(parseMetric);
  if (sections.length === 0 || metrics.length === 0)
    throw new Error("Config sections and metrics cannot be empty");
  return { sections, metrics };
}

function parseSection(value: unknown): SectionConfig {
  const item = value as Partial<SectionConfig>;
  if (!RANGES.has(String(item.range)))
    throw new Error(`Unsupported section range: ${String(item.range)}`);
  return {
    range: item.range as SectionConfig["range"],
    current: item.current === true,
    models: item.models === true,
  };
}

function parseMetric(value: unknown): MetricConfig {
  const item = value as Partial<MetricConfig>;
  if (typeof item.path !== "string" || !isSafeFieldPath(item.path)) {
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
