# Pi Usage

Configurable token and estimated-cost reporting for [Pi](https://pi.dev), with first-class TUI, RPC, and ACP support.

## Features

- Records finalized assistant usage in real time.
- Imports existing Pi session history in the background on first `/usage`.
- Includes compaction and branch-summary usage while preserving parent ToolResult aggregates separately and excluding them from totals to avoid double-counting subagents.
- Stores only usage metadata, partitioned by month under `~/.pi/agent/pi-usage/`.
- Produces one canonical Markdown report in Pi TUI and ACP clients such as WebAgent.
- Configures report sections and additive metrics without changing the collector.

## Install

```bash
pi install npm:@lelouchhe/pi-usage
```

Until the npm package is published, install from GitHub:

```bash
pi install git:github.com/LelouchHe/pi-usage
```

ACP adapters must expose Pi extension commands. With the LelouchHe/pi-acp fork:

```bash
pi-acp --extension-commands
```

## Usage

Run `/usage` in Pi or the agent-command equivalent in the ACP client, such as `//usage` in WebAgent.

Commands:

- `/usage` — current Session, including Tool/Subagent usage rollups
- `/usage help`
- `/usage show usage.input usage.output` — temporary current-Session metrics
- `/usage today`, `/usage 7d`, `/usage 2w`, `/usage 3m`, `/usage all` — global summary
- `/usage 2026-08-01 2026-08-15` — global inclusive date range
- `/usage daily|weekly|monthly <range>` — global trend using the same range syntax

`d`, `w`, and `m` mean aligned local calendar days, Monday-based weeks, and calendar months. Current and edge trend buckets can be partial. Explicit dates use `YYYY-MM-DD` with inclusive endpoints.

```markdown
## Usage · Current session

**1.2M tokens · $2.84**

| Model                        | Tokens |  Cost |
| ---------------------------- | -----: | ----: |
| `github-copilot/gpt-5.6-sol` |   1.0M | $2.20 |
| `pi/tool-aggregates`         |   200K | $0.64 |
```

The first report may include `History import is running; totals are partial.` Import continues silently in the background. Later reports omit the note after the initial import completes.

## Configuration

Create `~/.pi/agent/pi-usage/config.json` to override the default report:

```json
{
  "metrics": [
    {
      "path": "usage.totalTokens",
      "label": "Tokens",
      "format": "tokens"
    },
    {
      "path": "usage.cost.total",
      "label": "Cost",
      "format": "usd"
    }
  ]
}
```

All configuration properties are required. The values above are the complete defaults. Command arguments determine the report range and layout; configuration only chooses metrics.

### Metric properties

| Property | Values                    | Meaning                                                           |
| -------- | ------------------------- | ----------------------------------------------------------------- |
| `path`   | Safe dot path             | Numeric value to accumulate                                       |
| `label`  | Non-empty string          | Markdown table heading                                            |
| `format` | `tokens`, `usd`, `number` | Compact tokens, `$` with two decimals, or locale-formatted number |

A metric `path` can be any safe dot path whose final value is a finite number. The complete Pi Usage object is stored without dropping unknown fields, so newly added Pi metrics can be configured without updating this package. Missing or non-numeric values are skipped; a path absent from all stored records produces `n/a` and a warning.

Paths are not restricted to `usage.*`; future record objects such as `timing.durationMs` use the same lookup mechanism.

Current Pi Usage fields include:

- `usage.input`
- `usage.output`
- `usage.cacheRead`
- `usage.cacheWrite`
- `usage.cacheWrite1h`
- `usage.reasoning`
- `usage.totalTokens`
- `usage.cost.input`
- `usage.cost.output`
- `usage.cost.cacheRead`
- `usage.cost.cacheWrite`
- `usage.cost.total`

`reasoning` is already part of `output`, and `cacheWrite1h` is already part of `cacheWrite`; do not add these fields together to derive a total.

## Data

Usage records are append-only JSONL files:

```text
~/.pi/agent/pi-usage/
├── 2026-08.jsonl
├── config.json
├── import-state.json
└── import.lock/        # present only while an importer is active
```

Each record contains timestamp, session ID, canonical cwd, project display name, source, provider, actual and requested model when available, API, and Pi's complete Usage object. Prompt and response content are never copied into the usage ledger. ToolResult aggregate usage is retained with source `tool_result_aggregate`. Current-Session reports include it so delegated work is visible; global reports exclude it because Subagent Sessions are already counted independently.

Project identity uses canonical cwd for aggregation. Display names prefer `repository/worktree`, fall back to the directory name outside Git, and include relative subdirectories when needed.

## Development

```bash
npm install
npm run check
```
