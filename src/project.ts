import { existsSync, realpathSync } from "node:fs";
import { basename, relative, resolve, sep } from "node:path";
import { execFileSync } from "node:child_process";

export interface GitProjectInfo {
  repository: string;
  worktreeRoot: string;
}

export interface ProjectIdentity {
  cwd: string;
  name: string;
}

export function canonicalizeCwd(cwd: string): string {
  const absolute = resolve(cwd);
  return existsSync(absolute) ? realpathSync.native(absolute) : absolute;
}

export function resolveProject(
  cwd: string,
  customName?: string,
): ProjectIdentity {
  const canonicalCwd = canonicalizeCwd(cwd);
  if (customName?.trim()) return { cwd: canonicalCwd, name: customName.trim() };
  const gitProject = readGitProject(canonicalCwd);
  return {
    cwd: canonicalCwd,
    name: gitProject
      ? projectDisplayName(canonicalCwd, gitProject)
      : basename(canonicalCwd) || canonicalCwd,
  };
}

export function projectDisplayName(
  cwd: string,
  project: GitProjectInfo,
): string {
  const root = canonicalizeCwd(project.worktreeRoot);
  const worktree = basename(root);
  const prefix =
    worktree === project.repository
      ? project.repository
      : `${project.repository}/${worktree}`;
  const child = relative(root, canonicalizeCwd(cwd));
  return child && child !== ".." && !child.startsWith(`..${sep}`)
    ? `${prefix}/${child.split(sep).join("/")}`
    : prefix;
}

function readGitProject(cwd: string): GitProjectInfo | null {
  try {
    const worktreeRoot = runGit(cwd, ["rev-parse", "--show-toplevel"]);
    const remote = runGit(cwd, ["config", "--get", "remote.origin.url"]);
    const repository = repositoryName(remote) || basename(worktreeRoot);
    return { repository, worktreeRoot };
  } catch {
    return null;
  }
}

function runGit(cwd: string, args: string[]): string {
  return execFileSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 2000,
  }).trim();
}

function repositoryName(remote: string): string {
  const withoutQuery = remote.replace(/[?#].*$/, "").replace(/\/+$/, "");
  const tail = withoutQuery.slice(
    Math.max(withoutQuery.lastIndexOf("/"), withoutQuery.lastIndexOf(":")) + 1,
  );
  return tail.replace(/\.git$/, "");
}
