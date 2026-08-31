import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import {
  DynamicBorder,
  getAgentDir,
  getMarkdownTheme,
} from "@earendil-works/pi-coding-agent";
import { Container, Markdown, matchesKey, Text } from "@earendil-works/pi-tui";
import { join } from "node:path";
import { DEFAULT_CONFIG, parseConfig } from "./config.ts";
import { HistoryImporter } from "./importer.ts";
import { resolveProject, type ProjectIdentity } from "./project.ts";
import { parseUsageQuery, type UsageQuery } from "./query.ts";
import {
  missingMetricFields,
  renderHelpMarkdown,
  renderRangeMarkdown,
  renderTrendMarkdown,
  renderUsageMarkdown,
} from "./report.ts";
import {
  assistantRecordId,
  normalizeUsage,
  toolAggregateRecordId,
} from "./session-parser.ts";
import { UsageStore } from "./storage.ts";
import type { UsageSource } from "./types.ts";

export default function piUsage(pi: ExtensionAPI): void {
  const agentDir = getAgentDir();
  const store = new UsageStore(join(agentDir, "pi-usage"));
  const importer = new HistoryImporter(store, join(agentDir, "sessions"));
  let project: ProjectIdentity | null = null;

  pi.on("session_start", async (_event, ctx) => {
    project = resolveProject(ctx.cwd);
  });

  pi.on("message_end", async (event, ctx) => {
    if (
      event.message.role !== "assistant" &&
      event.message.role !== "toolResult"
    )
      return;
    const usage = normalizeUsage(event.message.usage);
    if (!usage) return;
    const identity = project ?? resolveProject(ctx.cwd);
    const session =
      ctx.sessionManager.getSessionFile() ?? ctx.sessionManager.getSessionId();

    if (event.message.role === "assistant") {
      const model = event.message.responseModel ?? event.message.model;
      store.append({
        id: assistantRecordId(
          session,
          event.message.timestamp,
          event.message.provider,
          model,
        ),
        timestamp: event.message.timestamp,
        sessionId: ctx.sessionManager.getSessionId(),
        cwd: identity.cwd,
        project: identity.name,
        source: "assistant",
        provider: event.message.provider,
        model,
        ...(model === event.message.model
          ? {}
          : { requestedModel: event.message.model }),
        api: event.message.api,
        usage,
      });
      return;
    }

    store.append({
      id: toolAggregateRecordId(
        session,
        event.message.timestamp,
        event.message.toolCallId,
      ),
      timestamp: event.message.timestamp,
      sessionId: ctx.sessionManager.getSessionId(),
      cwd: identity.cwd,
      project: identity.name,
      source: "tool_result_aggregate",
      provider: "pi",
      model: "tool-aggregates",
      toolName: event.message.toolName,
      usage,
    });
  });

  pi.on("session_compact", async (event, ctx) => {
    const entry = event.compactionEntry;
    const usage = normalizeUsage(entry.usage);
    if (!usage) return;
    const identity = project ?? resolveProject(ctx.cwd);
    const timestamp = toTimestamp(entry.timestamp);
    store.append({
      id: recordId(ctx, entry.id, "compaction", timestamp),
      timestamp,
      sessionId: ctx.sessionManager.getSessionId(),
      cwd: identity.cwd,
      project: identity.name,
      source: "compaction",
      provider: "pi",
      model: "summaries",
      usage,
    });
  });

  pi.registerCommand("usage", {
    description: "Show token and cost usage; run '/usage help' for options",
    handler: async (args, ctx) => {
      let query: UsageQuery;
      try {
        query = parseUsageQuery(args);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.notify(`${message}. Run /usage help for syntax.`, "warning");
        return;
      }

      if (query.kind === "help") {
        await showMarkdown(renderHelpMarkdown(), ctx);
        return;
      }

      const identity = project ?? resolveProject(ctx.cwd);
      const partial = !importer.isComplete();
      importer.start((message) => {
        ctx.ui.notify(message, "error");
      });

      let config = DEFAULT_CONFIG;
      try {
        config = parseConfig(store.readJson("config.json", DEFAULT_CONFIG));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.notify(
          `Invalid usage config; using defaults: ${message}`,
          "warning",
        );
      }

      const records = store.readAll();
      if (!partial) {
        const missing = missingMetricFields(records, config.metrics);
        if (missing.length > 0) {
          ctx.ui.notify(
            `Configured metrics have no numeric values: ${missing.join(", ")}`,
            "warning",
          );
        }
      }
      const markdown =
        query.kind === "default"
          ? renderUsageMarkdown({
              records,
              config,
              currentProject: identity.cwd,
              partial,
            })
          : query.kind === "range"
            ? renderRangeMarkdown({
                records,
                start: query.start,
                endExclusive: query.endExclusive,
                label: query.label,
                metrics: config.metrics,
                partial,
              })
            : renderTrendMarkdown({
                records,
                bucket: query.bucket,
                start: query.start,
                endExclusive: query.endExclusive,
                metrics: config.metrics,
                partial,
              });
      await showMarkdown(markdown, ctx);
    },
  });
}

function recordId(
  ctx: {
    sessionManager: {
      getSessionFile(): string | null | undefined;
      getSessionId(): string;
    };
  },
  entryId: string | null,
  source: UsageSource,
  timestamp: number,
): string {
  const session =
    ctx.sessionManager.getSessionFile() ?? ctx.sessionManager.getSessionId();
  return `${session}:${entryId ?? timestamp}:${source}`;
}

async function showMarkdown(
  markdown: string,
  ctx: ExtensionCommandContext,
): Promise<void> {
  if (ctx.mode !== "tui") {
    ctx.ui.notify(markdown, "info");
    return;
  }

  await ctx.ui.custom((_tui, theme, _kb, done) => {
    const container = new Container();
    container.addChild(
      new DynamicBorder((value: string) => theme.fg("accent", value)),
    );
    container.addChild(new Markdown(markdown, 1, 1, getMarkdownTheme()));
    container.addChild(
      new Text(theme.fg("dim", "Press Enter or Esc to close"), 1, 0),
    );
    container.addChild(
      new DynamicBorder((value: string) => theme.fg("accent", value)),
    );
    return {
      render: (width: number) => container.render(width),
      invalidate: () => {
        container.invalidate();
      },
      handleInput: (data: string) => {
        if (matchesKey(data, "enter") || matchesKey(data, "escape")) {
          done(undefined);
        }
      },
    };
  });
}

function toTimestamp(value: number | string): number {
  if (typeof value === "number") return value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
}
