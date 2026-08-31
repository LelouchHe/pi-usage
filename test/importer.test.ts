import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HistoryImporter } from "../src/importer.ts";
import { UsageStore } from "../src/storage.ts";

const usage = {
  input: 10,
  output: 5,
  cacheRead: 2,
  cacheWrite: 1,
  totalTokens: 18,
  cost: {
    input: 0.1,
    output: 0.2,
    cacheRead: 0.01,
    cacheWrite: 0.01,
    total: 0.32,
  },
};

test("history importer incrementally imports changed session files without duplicate records", () => {
  const root = mkdtempSync(join(tmpdir(), "pi-usage-import-"));
  const usageDir = join(root, "usage");
  const sessionsDir = join(root, "sessions");
  mkdirSync(sessionsDir);
  const sessionFile = join(sessionsDir, "session.jsonl");

  const entries = [
    { type: "session", id: "s1", cwd: root },
    {
      type: "message",
      id: "a1",
      message: {
        role: "assistant",
        provider: "test",
        model: "one",
        timestamp: 1000,
        usage,
      },
    },
  ];
  writeFileSync(
    sessionFile,
    `${entries.map((value) => JSON.stringify(value)).join("\n")}\n`,
  );

  try {
    const store = new UsageStore(usageDir);
    const importer = new HistoryImporter(store, sessionsDir);

    assert.equal(importer.isComplete(), false);
    assert.equal(importer.sync(), 1);
    assert.equal(importer.isComplete(), true);
    assert.equal(importer.sync(), 0);

    entries.push({
      type: "message",
      id: "a2",
      message: {
        role: "assistant",
        provider: "test",
        model: "two",
        timestamp: 2000,
        usage,
      },
    });
    writeFileSync(
      sessionFile,
      `${entries.map((value) => JSON.stringify(value)).join("\n")}\n`,
    );

    assert.equal(importer.sync(), 1);
    assert.deepEqual(
      store.readAll().map((record) => record.model),
      ["one", "two"],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
