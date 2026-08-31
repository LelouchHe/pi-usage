import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { UsageStore } from "../src/storage.ts";
import type { UsageRecord } from "../src/types.ts";

function record(id: string, timestamp: number): UsageRecord {
  return {
    id,
    timestamp,
    sessionId: "s1",
    cwd: "/code/project",
    project: "project",
    source: "assistant",
    provider: "test",
    model: "model",
    usage: {
      input: 1,
      output: 2,
      cacheRead: 3,
      cacheWrite: 4,
      totalTokens: 10,
      cost: {
        input: 0.1,
        output: 0.2,
        cacheRead: 0.3,
        cacheWrite: 0.4,
        total: 1,
      },
    },
  };
}

test("store partitions by month and deduplicates stable record ids when reading", () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-usage-"));
  try {
    const store = new UsageStore(dir);
    const january = record("one", Date.parse("2026-01-10T00:00:00Z"));
    const february = record("two", Date.parse("2026-02-10T00:00:00Z"));

    store.append(january);
    store.append(january);
    store.append(february);

    assert.deepEqual(
      store.readAll().map((value) => value.id),
      ["one", "two"],
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
