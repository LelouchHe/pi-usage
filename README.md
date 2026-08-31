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

Additional Markdown reports:

- `/usage help`
- `/usage range 2026-08-01 2026-08-15`
- `/usage daily [count]` (default 7, maximum 365)
- `/usage weekly [count]` (default 8, maximum 104)
- `/usage monthly [count]` (default 12, maximum 60)
- `/usage daily|weekly|monthly <start> <end>`

Dates use `YYYY-MM-DD`, machine-local time, and inclusive endpoints. Weeks start on Monday; the first and last weekly or monthly bucket may be partial. Count-based trends include the current incomplete day, week, or month through today and mark it as `Current`.

```markdown
## Usage

### Today

**Current:** 1.2M tokens · $2.84

**All:** 2.7M tokens · $5.31

| Model                             | Tokens |  Cost |
| --------------------------------- | -----: | ----: |
| `github-copilot/gpt-5.6-sol`      |   1.6M | $3.72 |
| `github-copilot/claude-haiku-4.5` |   720K | $0.91 |

### All time

**84.2M tokens · $128.40**

| Model                             | Tokens |   Cost |
| --------------------------------- | -----: | -----: |
| `github-copilot/gpt-5.6-sol`      |  46.8M | $78.20 |
| `github-copilot/claude-haiku-4.5` |  21.4M | $19.70 |
```

The first report may include `History import is running; totals are partial.` Import continues silently in the background. Later reports omit the note after the initial import completes.

## Configuration

Create `~/.pi/agent/pi-usage/config.json` to override the default report:

```json
{
  "sections": [
    {
      "range": "today",
      "current": true,
      "models": true
    },
    {
      "range": "all",
      "current": false,
      "models": true
    }
  ],
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

All configuration properties are required. The values above are the complete defaults.

### Section properties

| Property  | Values                          | Meaning                                                                  |
| --------- | ------------------------------- | ------------------------------------------------------------------------ |
| `range`   | `today`, `week`, `month`, `all` | Time range shown by this section                                         |
| `current` | `true`, `false`                 | Also show the current canonical cwd; all-project totals are always shown |
| `models`  | `true`, `false`                 | Show a `provider/model` breakdown                                        |

Period boundaries use the machine's local timezone, and weeks start on Monday. Section titles are derived from `range`.

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

Each record contains timestamp, session ID, canonical cwd, project display name, source, provider, actual and requested model when available, API, and Pi's complete Usage object. Prompt and response content are never copied into the usage ledger. ToolResult aggregate usage is retained with source `tool_result_aggregate` for future attribution, but is not included in reports.

Project identity uses canonical cwd for aggregation. Display names prefer `repository/worktree`, fall back to the directory name outside Git, and include relative subdirectories when needed.

## Development

```bash
npm install
npm run check
```
