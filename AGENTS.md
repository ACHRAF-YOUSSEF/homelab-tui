# homelab-tui Agent Guide

## Product and Stack

`homelab-tui` is a released terminal application for monitoring and controlling multiple homelab hosts over SSH. It uses Bun, strict TypeScript, React 18, Ink 5, `node-ssh`, and Zod. Remote hosts may run Linux, macOS, or Windows. The app discovers Docker containers and native services, shows system metrics and logs, and performs service actions.

Keep the TUI fast, keyboard-first, readable at common terminal sizes, and safe around remote actions. Do not replace the stack or add a dependency unless the requested change cannot be handled cleanly by Ink, React, Bun, or the existing packages.

## Start Here

- Read the complete path affected by a change before editing it. For a UI behavior, trace input handling, state, rendering, and footer hints together.
- Use the code-review graph first for exploration or impact analysis when its MCP tools are available. Fall back to `rg` and direct file inspection when the graph is unavailable or stale.
- Treat `package.json` and the current source as authoritative. `CLAUDE.md` contains outdated single-host and reconnect notes.
- Preserve unrelated work in the working tree. Keep changes focused; avoid speculative abstractions and formatting churn.

## Commands

```sh
bun install                 # install dependencies
bun run dev                 # run from source
bunx tsc --noEmit           # required type check
bun run build:linux-x64     # quick compiled-binary check on Linux
bun run build               # all release targets; use only when release coverage is needed
```

There is currently no lint script and no automated test suite. For non-trivial pure logic, add the smallest colocated `*.test.ts` file and run `bun test`. For rendering or keyboard changes, run the type check and verify the affected flow manually in a real terminal. Never report a check as passing unless it was run.

## Architecture

- `src/cli.tsx` and `src/main.tsx`: CLI startup and Ink rendering.
- `src/ui/Root.tsx`: configuration, host selection, credentials, and the transition into monitoring.
- `src/ui/MultiMonitor.tsx`: multi-host orchestration, pane focus, global modes, and shared keyboard handling.
- `src/ui/MonitorPane.tsx`: per-host connection, polling, reconnect state, selection, and rendering.
- `src/ui/App.tsx`: single-host monitoring path. Check both single- and multi-host callers before changing shared behavior.
- `src/ui/*`: focused presentation components for hosts, services, metrics, details, logs, credentials, and forms.
- `src/core/monitor.ts`: coordinates OS detection, snapshots, service discovery, commands, and log streams.
- `src/adapters/*`: OS- and Docker-specific command construction and parsing.
- `src/transports/ssh.ts`: SSH authentication, execution, streaming, disconnect, and reconnect plumbing.
- `src/config/*`: Zod-validated configuration and persisted settings.
- `src/core/types.ts`: shared domain types.

The main flow is config -> `Root` -> `MultiMonitor`/`MonitorPane` -> `Monitor` -> SSH/adapters -> snapshot state -> Ink render. Fix shared behavior at the narrowest common layer instead of patching each caller.

## TUI Quality Rules

- Treat terminal width and height as runtime inputs. Avoid fixed widths that overflow; define intentional compact behavior for narrow or short terminals.
- Keep one obvious focus indicator. Selection, focus, disabled state, warning state, and failure state must remain distinguishable without relying on color alone.
- When a keybinding changes, update its input handler and visible footer/help text in the same change.
- Truncate or wrap hostnames, images, ports, paths, errors, and log lines deliberately. Do not let untrusted remote text break borders or layout.
- Preserve loading, empty, connecting, reconnecting, partial-failure, and error states when changing the happy path.
- Reuse the existing visual language: cyan for structure/actions, yellow for focused panels, green for healthy/running state, red for failures or dangerous state, and dim text for secondary metadata. Introduce a theme layer only as part of an explicitly requested theming change.
- For visible changes, manually check at least `80x24` and one wide layout. Update an `assets/` screenshot when the user-facing layout changes materially.

## Remote-Operation Safety

- Treat restart, stop, start, kill, delete, and configuration writes as operational actions. Preserve confirmation or guard behavior around destructive actions.
- Quote or validate values interpolated into remote shell or PowerShell commands. Never expose private keys, passphrases, tokens, or full credential-bearing configuration in logs or errors.
- Keep OS-specific behavior in the matching adapter. Do not fix one platform by silently changing another platform's command path.
- Ensure streams, timers, SSH listeners, and reconnect loops are cleaned up on host removal, navigation, and exit.

## Completion Criteria

Before finishing a code change:

1. The requested behavior works through the real call path.
2. `bunx tsc --noEmit` passes.
3. Relevant tests or manual terminal checks pass in proportion to the change.
4. Key hints, documentation, configuration examples, and screenshots touched by the behavior are still accurate.
5. The diff contains no generated binaries, `node_modules`, graph database files, secrets, or unrelated cleanup.
