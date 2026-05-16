# Repository Guidelines

## Project Structure & Module Organization

`homelab-tui` is currently a minimal repository for a future terminal UI for homelab management. The root contains `README.md`, `CLAUDE.md`, and this guide. No application source tree, tests, or assets have been added yet.

When implementation begins, keep source code in `src/`, tests in `tests/` or colocated next to modules, and static/demo assets in `assets/`. Keep generated or agent-local state out of source control unless it is intentionally part of the project.

## Build, Test, and Development Commands

No build or test commands are defined yet. Add the chosen stack's commands here as soon as tooling exists.

Expected examples once tooling exists:

- `make test` or `<package-manager> test`: run the full test suite.
- `make lint` or `<package-manager> lint`: run format and static checks.
- `make dev` or `<package-manager> dev`: start the local TUI development workflow.

Until then, contributors should avoid assuming a language, package manager, or framework.

## Coding Style & Naming Conventions

Follow the conventions of the stack selected for the TUI. Prefer small modules, descriptive names, and explicit error handling for homelab operations. Use ASCII for source and docs unless a file already requires another character set.

After formatter or linter tooling is added, document the exact command and required configuration here. Avoid mixing formatting-only churn with behavioral changes.

## Testing Guidelines

There is no test framework yet. New code should introduce focused tests alongside the implementation. Name tests after behavior, for example `renders_service_status` or `test_restart_requires_confirmation`.

For TUI behavior, cover command parsing, state transitions, and error handling separately from rendering when possible. Add manual verification notes for terminal rendering paths that are not practical to automate.

## Commit & Pull Request Guidelines

The current Git history only contains `first commit`, so no detailed convention exists yet. Use concise, imperative commit subjects such as `Add service status model` or `Document development setup`.

Pull requests should include a short description, reason for the change, verification performed, and screenshots or terminal captures for visible TUI changes. Link related issues when available.

## Agent-Specific Instructions

`CLAUDE.md` notes that this repository has a code-review graph. When graph MCP tools are available, use them before broad file searches for code exploration, impact analysis, and review context. Fall back to direct file inspection only when graph data is unavailable or incomplete.
