# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`homelab-tui` — terminal UI for monitoring a homelab server over SSH. Bun + TypeScript + React + Ink. Discovers Docker containers and shows system metrics on Linux/macOS/Windows remotes.

## Commands

```sh
bun install        # install deps
bun dev            # run (alias: bun start)
```

No build step — Bun runs TypeScript directly.

## Architecture

```
src/
  main.tsx                  # entry: load config, render <App>
  config/loader.ts          # zod-validated config loader
  transports/ssh.ts         # SSHTransport wrapping node-ssh
  core/
    types.ts                # all shared types (Service, SystemInfo, MonitorSnapshot…)
    os-detect.ts            # uname → PowerShell fallback
    monitor.ts              # Monitor class: connect, refresh(), run()
  adapters/
    docker.ts               # getDockerServices + restart/stop/start/logs
    linux-system.ts         # /proc/stat, free -b, df
    macos-system.ts         # sysctl, vm_stat, df
    windows-system.ts       # PowerShell CIM queries
  ui/
    App.tsx                 # root component: state, keyboard, 3s polling
    Header.tsx              # host/os/node info + last-updated
    SystemPanel.tsx         # CPU/RAM/disk bars
    ServiceList.tsx         # scrollable container list
    ServiceDetails.tsx      # selected service detail rows
    LogPanel.tsx            # last 20 visible lines from docker logs
    Footer.tsx              # keybinding hints + action flash messages
```

**Data flow:** `App` holds a `Monitor` ref → calls `monitor.refresh()` every 3 s → sets `snapshot` state → UI re-renders. Docker actions call `monitor.run(cmd)` directly then re-refresh.

**OS adapter dispatch** lives in `monitor.ts` using dynamic `import()` per detected OS.

## Key design decisions

- Single host for MVP (first entry in `hosts[]`)
- No reconnect logic — restart TUI if SSH drops
- `includeStoppedContainers: true` uses `docker ps -aq` (all containers)
- Health-based status takes precedence over `State.Running`

## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |
