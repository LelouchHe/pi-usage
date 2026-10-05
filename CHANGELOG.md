# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-10-05

### Added

- **Usage is recorded and reported without leaving Pi.** Finalized assistant Usage is captured in real time, and `/usage` renders one canonical Markdown report in the Pi TUI, RPC, and ACP clients such as WebAgent. Reports cover the current Session with Tool and Subagent rollups, a global summary (`today`, `7d`, `2w`, `3m`, `all`, or an explicit inclusive `YYYY-MM-DD` date range), and `daily`/`weekly`/`monthly` trends whose ranges default to 7 days, 4 weeks, and 6 months. `d`, `w`, and `m` mean aligned local calendar days, Monday-based weeks, and calendar months; bare counts follow the bucket, and current or edge trend buckets may be partial.
- **Report metrics are configurable without changing the collector.** `~/.pi/agent/pi-usage/config.json` selects additive metrics by `path`, `label`, and `format` (`tokens`, `usd`, `number`). Any safe dot path ending in a finite number works, and stored Usage objects keep unknown fields, so newly added Pi metrics need no package update. `/usage show usage.input usage.output` renders temporary current-Session metrics, and a path missing from every record renders `n/a` with a warning.
- **Existing Pi session history is imported in the background.** The first `/usage` starts an import of prior Sessions and notes that totals are partial; every later report drops the note once the import finishes.
- **Compaction, branch summaries, and delegated work are accounted for.** Summary usage appears as `pi/summaries` because those entries do not identify the generating model. ToolResult usage reported to a parent Session is stored under source `tool_result_aggregate` and shown as `pi/tool-aggregates` in current-Session reports, while global reports exclude it because Subagent Sessions are counted independently — so delegated work stays visible without being counted twice.
- **The ledger is local, append-only, and metadata-only.** Records are monthly JSONL files under `~/.pi/agent/pi-usage/`, holding timestamp, Session id, canonical cwd, project display name, source, provider, model, API, and Pi's complete Usage object. Prompt and response content is never copied. Project labels prefer `repository/worktree`, fall back to the directory name outside Git, and disambiguate with relative subdirectories when needed.

[0.1.0]: https://github.com/LelouchHe/pi-usage/releases/tag/v0.1.0
