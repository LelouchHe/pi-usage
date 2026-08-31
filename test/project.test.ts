import test from "node:test";
import assert from "node:assert/strict";
import { canonicalizeCwd, projectDisplayName } from "../src/project.ts";

test("canonical cwd resolves dot segments without changing case", () => {
  assert.equal(
    canonicalizeCwd("/Users/Me/code/../code/App"),
    "/Users/Me/code/App",
  );
});

test("project display combines repository, worktree, and relative directory", () => {
  assert.equal(
    projectDisplayName("/code/webagent/main", {
      repository: "webagent",
      worktreeRoot: "/code/webagent/main",
    }),
    "webagent/main",
  );
  assert.equal(
    projectDisplayName("/code/webagent/main/src", {
      repository: "webagent",
      worktreeRoot: "/code/webagent/main",
    }),
    "webagent/main/src",
  );
  assert.equal(
    projectDisplayName("/code/pi-usage", {
      repository: "pi-usage",
      worktreeRoot: "/code/pi-usage",
    }),
    "pi-usage",
  );
});
