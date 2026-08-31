import test from "node:test";
import assert from "node:assert/strict";
import { parseSessionJsonl } from "../src/session-parser.ts";

const usage = {
  input: 10,
  output: 5,
  cacheRead: 2,
  cacheWrite: 1,
  totalTokens: 18,
  future: { nested: 7 },
  cost: {
    input: 0.1,
    output: 0.2,
    cacheRead: 0.01,
    cacheWrite: 0.01,
    total: 0.32,
  },
};

test("history parser preserves assistant, summary, and non-counted tool aggregate usage", () => {
  const jsonl = [
    { type: "session", id: "session-1", cwd: "/code/project" },
    {
      type: "message",
      id: "a1",
      message: {
        role: "assistant",
        provider: "github-copilot",
        model: "auto",
        responseModel: "gpt-5.6-sol",
        api: "responses",
        timestamp: 1000,
        usage,
      },
    },
    {
      type: "message",
      id: "t1",
      message: { role: "toolResult", timestamp: 1001, usage },
    },
    { type: "compaction", id: "c1", timestamp: 1002, usage },
    { type: "branch_summary", id: "b1", timestamp: 1003, usage },
  ]
    .map((value) => JSON.stringify(value))
    .join("\n");

  const records = parseSessionJsonl(jsonl, "/sessions/session-1.jsonl", {
    canonicalCwd: "/code/project",
    project: "project",
  });

  assert.deepEqual((records[0]?.usage as Record<string, unknown>).future, {
    nested: 7,
  });
  assert.deepEqual(
    records.map((record) => [
      record.id,
      record.source,
      record.model,
      record.requestedModel,
    ]),
    [
      [
        "/sessions/session-1.jsonl:assistant:1000:github-copilot/gpt-5.6-sol",
        "assistant",
        "gpt-5.6-sol",
        "auto",
      ],
      [
        "/sessions/session-1.jsonl:tool-result:1001:t1",
        "tool_result_aggregate",
        "tool-aggregates",
        undefined,
      ],
      [
        "/sessions/session-1.jsonl:c1:compaction",
        "compaction",
        "summaries",
        undefined,
      ],
      [
        "/sessions/session-1.jsonl:b1:branch_summary",
        "branch_summary",
        "summaries",
        undefined,
      ],
    ],
  );
});
