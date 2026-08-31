export type UsageSource =
  "assistant" | "compaction" | "branch_summary" | "tool_result_aggregate";

export interface Usage {
  [key: string]: unknown;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cacheWrite1h?: number;
  reasoning?: number;
  totalTokens: number;
  cost: {
    [key: string]: unknown;
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
}

export interface UsageRecord {
  id: string;
  timestamp: number;
  sessionId: string;
  cwd: string;
  project: string;
  source: UsageSource;
  provider: string;
  model: string;
  requestedModel?: string;
  api?: string;
  toolName?: string;
  usage: Usage;
}

export type MetricField = string;
export type MetricUnit = "tokens" | "usd" | "number";
export type PeriodKey = "today" | "week" | "month" | "all";

export interface PeriodConfig {
  key: PeriodKey;
  name: string;
  currentProject: boolean;
  groupByModel: boolean;
}

export interface MetricConfig {
  field: MetricField;
  name: string;
  unit: MetricUnit;
}

export interface UsageConfig {
  periods: PeriodConfig[];
  metrics: MetricConfig[];
}

export type MetricTotals = Partial<Record<string, number>>;
