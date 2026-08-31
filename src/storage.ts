import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { UsageRecord } from "./types.ts";

export class UsageStore {
  readonly directory: string;

  constructor(directory: string) {
    this.directory = directory;
    mkdirSync(directory, { recursive: true, mode: 0o700 });
  }

  append(record: UsageRecord): boolean {
    try {
      appendFileSync(
        join(this.directory, `${monthKey(record.timestamp)}.jsonl`),
        `${JSON.stringify(record)}\n`,
        {
          encoding: "utf8",
          mode: 0o600,
        },
      );
      return true;
    } catch {
      return false;
    }
  }

  readAll(): UsageRecord[] {
    const records = new Map<string, UsageRecord>();
    for (const name of readdirSync(this.directory)
      .filter((value) => /^\d{4}-\d{2}\.jsonl$/.test(value))
      .sort()) {
      const content = readFileSync(join(this.directory, name), "utf8");
      for (const line of content.split("\n")) {
        if (!line.trim()) continue;
        try {
          const record = JSON.parse(line) as UsageRecord;
          if (typeof record.id === "string" && !records.has(record.id))
            records.set(record.id, record);
        } catch {
          // Ignore a partial trailing line or manually damaged record.
        }
      }
    }
    return [...records.values()].sort(
      (a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id),
    );
  }

  readJson<T>(name: string, fallback: T): T {
    const path = join(this.directory, name);
    if (!existsSync(path)) return fallback;
    try {
      return JSON.parse(readFileSync(path, "utf8")) as T;
    } catch {
      return fallback;
    }
  }

  writeJson(name: string, value: unknown): void {
    const path = join(this.directory, name);
    const temporary = `${path}.${process.pid}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    renameSync(temporary, path);
  }
}

function monthKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
