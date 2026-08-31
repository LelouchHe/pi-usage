import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import { resolveProject } from "./project.ts";
import { parseSessionJsonl, sessionCwd } from "./session-parser.ts";
import type { UsageStore } from "./storage.ts";

interface ImportedFile {
  size: number;
  mtimeMs: number;
}

interface ImportState {
  complete: boolean;
  files: Partial<Record<string, ImportedFile>>;
  error?: string;
}

const EMPTY_STATE: ImportState = { complete: false, files: {} };
const STALE_LOCK_MS = 10 * 60 * 1000;

export class HistoryImporter {
  private readonly lockPath: string;
  private readonly store: UsageStore;
  private readonly sessionsDirectory: string;

  constructor(store: UsageStore, sessionsDirectory: string) {
    this.store = store;
    this.sessionsDirectory = sessionsDirectory;
    this.lockPath = join(store.directory, "import.lock");
  }

  isComplete(): boolean {
    return (
      this.store.readJson<ImportState>("import-state.json", EMPTY_STATE)
        .complete === true
    );
  }

  start(onError?: (message: string) => void): boolean {
    if (!this.acquireLock()) return false;
    setImmediate(() => {
      try {
        this.sync();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const previous = this.store.readJson<ImportState>(
          "import-state.json",
          EMPTY_STATE,
        );
        this.store.writeJson("import-state.json", {
          ...previous,
          complete: false,
          error: message,
        });
        onError?.(`Usage history import failed: ${message}`);
      } finally {
        rmSync(this.lockPath, { recursive: true, force: true });
      }
    });
    return true;
  }

  sync(): number {
    const previous = this.store.readJson<ImportState>(
      "import-state.json",
      EMPTY_STATE,
    );
    const nextFiles = { ...previous.files };
    const knownIds = new Set(this.store.readAll().map((record) => record.id));
    const projects = new Map<string, ReturnType<typeof resolveProject>>();
    let imported = 0;

    for (const path of collectJsonl(this.sessionsDirectory)) {
      const stats = statSync(path);
      const seen = previous.files[path];
      if (seen?.size === stats.size && seen.mtimeMs === stats.mtimeMs) continue;

      const content = readFileSync(path, "utf8");
      const cwd = sessionCwd(content);
      if (!cwd) continue;
      const project = projects.get(cwd) ?? resolveProject(cwd);
      projects.set(cwd, project);
      for (const record of parseSessionJsonl(content, path, {
        canonicalCwd: project.cwd,
        project: project.name,
      })) {
        if (knownIds.has(record.id)) continue;
        if (!this.store.append(record))
          throw new Error(`Could not write usage record ${record.id}`);
        knownIds.add(record.id);
        imported += 1;
      }
      nextFiles[path] = { size: stats.size, mtimeMs: stats.mtimeMs };
    }

    this.store.writeJson("import-state.json", {
      complete: true,
      files: nextFiles,
    });
    return imported;
  }

  private acquireLock(): boolean {
    try {
      mkdirSync(this.lockPath);
      return true;
    } catch {
      try {
        const age = Date.now() - statSync(this.lockPath).mtimeMs;
        if (age <= STALE_LOCK_MS) return false;
        rmSync(this.lockPath, { recursive: true, force: true });
        mkdirSync(this.lockPath);
        return true;
      } catch {
        return false;
      }
    }
  }
}

function collectJsonl(directory: string): string[] {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  const files: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectJsonl(path));
    else if (entry.isFile() && entry.name.endsWith(".jsonl")) files.push(path);
  }
  return files.sort();
}
