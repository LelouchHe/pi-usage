import type { Usage, UsageRecord, UsageSource } from "./types.ts";

export function sessionCwd(content: string): string | null {
  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    try {
      const value = JSON.parse(line) as { type?: unknown; cwd?: unknown };
      if (value.type === "session")
        return typeof value.cwd === "string" ? value.cwd : null;
    } catch {
      // Continue until a valid session header is found.
    }
  }
  return null;
}

export function parseSessionJsonl(
  content: string,
  sessionFile: string,
  project: { canonicalCwd: string; project: string },
): UsageRecord[] {
  const entries: unknown[] = [];
  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line));
    } catch {
      // Ignore partial or damaged lines.
    }
  }

  const header = entries.find(isSessionHeader);
  const sessionId = header?.id ?? sessionFile;
  const records: UsageRecord[] = [];

  for (const value of entries) {
    const entry = value as Record<string, unknown>;
    const entryId = typeof entry.id === "string" ? entry.id : null;
    if (!entryId) continue;

    if (entry.type === "message") {
      const record = parseMessageEntry({
        entry,
        entryId,
        sessionFile,
        sessionId,
        project,
      });
      if (record) records.push(record);
      continue;
    }

    if (entry.type === "compaction" || entry.type === "branch_summary") {
      const usage = normalizeUsage(entry.usage);
      if (!usage) continue;
      records.push(
        makeRecord({
          sessionFile,
          entryId,
          sessionId,
          project,
          source: entry.type,
          timestamp: parseTimestamp(entry.timestamp),
          provider: "pi",
          model: "summaries",
          usage,
        }),
      );
    }
  }

  return records;
}

function parseMessageEntry(options: {
  entry: Record<string, unknown>;
  entryId: string;
  sessionFile: string;
  sessionId: string;
  project: { canonicalCwd: string; project: string };
}): UsageRecord | null {
  const message = options.entry.message as Record<string, unknown> | undefined;
  const usage = normalizeUsage(message?.usage);
  if (!message || !usage) return null;
  const messageTimestamp = parseTimestamp(
    message.timestamp ?? options.entry.timestamp,
  );

  if (message.role === "assistant") {
    const provider = stringValue(message.provider, "unknown");
    const requestedModel = stringValue(message.model, "unknown");
    const model = stringValue(message.responseModel, requestedModel);
    return {
      ...makeRecord({
        ...options,
        source: "assistant",
        timestamp: messageTimestamp,
        provider,
        model,
        requestedModel: model === requestedModel ? undefined : requestedModel,
        api: typeof message.api === "string" ? message.api : undefined,
        usage,
      }),
      id: assistantRecordId(
        options.sessionFile,
        messageTimestamp,
        provider,
        model,
      ),
    };
  }

  if (message.role !== "toolResult") return null;
  const toolCallId = stringValue(message.toolCallId, options.entryId);
  return {
    ...makeRecord({
      ...options,
      source: "tool_result_aggregate",
      timestamp: messageTimestamp,
      provider: "pi",
      model: "tool-aggregates",
      toolName:
        typeof message.toolName === "string" ? message.toolName : undefined,
      usage,
    }),
    id: toolAggregateRecordId(
      options.sessionFile,
      messageTimestamp,
      toolCallId,
    ),
  };
}

function makeRecord(options: {
  sessionFile: string;
  entryId: string;
  sessionId: string;
  project: { canonicalCwd: string; project: string };
  source: UsageSource;
  timestamp: number;
  provider: string;
  model: string;
  requestedModel?: string;
  api?: string;
  toolName?: string;
  usage: Usage;
}): UsageRecord {
  return {
    id: `${options.sessionFile}:${options.entryId}:${options.source}`,
    timestamp: options.timestamp,
    sessionId: options.sessionId,
    cwd: options.project.canonicalCwd,
    project: options.project.project,
    source: options.source,
    provider: options.provider,
    model: options.model,
    ...(options.requestedModel
      ? { requestedModel: options.requestedModel }
      : {}),
    ...(options.api ? { api: options.api } : {}),
    ...(options.toolName ? { toolName: options.toolName } : {}),
    usage: options.usage,
  };
}

export function assistantRecordId(
  session: string,
  timestamp: number,
  provider: string,
  model: string,
): string {
  return `${session}:assistant:${timestamp}:${provider}/${model}`;
}

export function toolAggregateRecordId(
  session: string,
  timestamp: number,
  toolCallId: string,
): string {
  return `${session}:tool-result:${timestamp}:${toolCallId}`;
}

export function normalizeUsage(value: unknown): Usage | null {
  const raw = value as Record<string, unknown> | undefined;
  const cost = raw?.cost as Record<string, unknown> | undefined;
  if (!raw || !cost) return null;
  const required = [
    "input",
    "output",
    "cacheRead",
    "cacheWrite",
    "totalTokens",
  ] as const;
  if (required.some((field) => !isNumber(raw[field]))) return null;
  const costFields = [
    "input",
    "output",
    "cacheRead",
    "cacheWrite",
    "total",
  ] as const;
  if (costFields.some((field) => !isNumber(cost[field]))) return null;

  return {
    ...raw,
    input: raw.input as number,
    output: raw.output as number,
    cacheRead: raw.cacheRead as number,
    cacheWrite: raw.cacheWrite as number,
    ...(isNumber(raw.cacheWrite1h) ? { cacheWrite1h: raw.cacheWrite1h } : {}),
    ...(isNumber(raw.reasoning) ? { reasoning: raw.reasoning } : {}),
    totalTokens: raw.totalTokens as number,
    cost: {
      ...cost,
      input: cost.input as number,
      output: cost.output as number,
      cacheRead: cost.cacheRead as number,
      cacheWrite: cost.cacheWrite as number,
      total: cost.total as number,
    },
  };
}

function isSessionHeader(
  value: unknown,
): value is { type: "session"; id: string } {
  const item = value as { type?: unknown; id?: unknown };
  return item.type === "session" && typeof item.id === "string";
}

function parseTimestamp(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value ? value : fallback;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
