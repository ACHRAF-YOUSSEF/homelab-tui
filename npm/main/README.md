<div align="center">

# 🖥️ homelab-tui

**A cross-platform terminal UI for monitoring your homelab over SSH**

[![Bun](https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React%20Ink-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://github.com/vadimdemedes/ink)
[![npm](https://img.shields.io/npm/v/homelab-tui?style=for-the-badge&logo=npm&logoColor=white)](https://www.npmjs.com/package/homelab-tui)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](https://github.com/ACHRAF-YOUSSEF/homelab-tui/blob/main/LICENSE)

[![Linux](https://img.shields.io/badge/Linux-FCC624?style=for-the-badge&logo=linux&logoColor=black)]()
[![macOS](https://img.shields.io/badge/macOS-000000?style=for-the-badge&logo=apple&logoColor=white)]()
[![Windows](https://img.shields.io/badge/Windows-0078D4?style=for-the-badge&logo=windows&logoColor=white)]()

<p>
  <a href="https://github.com/ACHRAF-YOUSSEF">
    <img src="https://img.shields.io/badge/Author-Achraf%20Youssef-181717?style=for-the-badge&logo=github" />
  </a>
  <a href="https://achraf-youssef.github.io/portfolio/">
    <img src="https://img.shields.io/badge/Portfolio-Visit-blueviolet?style=for-the-badge&logo=firefox" />
  </a>
</p>

> Discovers Docker containers and running programs (Jellyfin, Ollama, LM Studio, game servers…), streams live logs, and shows system metrics — all over SSH. Supports Linux, macOS, and Windows remote hosts.

</div>

---

## Install

```sh
npm install -g homelab-tui
```

**Using Bun?** Bun blocks postinstall scripts by default — trust the package first:

```sh
bun add -g homelab-tui
bun pm trust homelab-tui
bun add -g homelab-tui   # re-run so the postinstall executes
```

The correct binary for your platform is downloaded automatically on install. No Bun runtime needed.

## Usage

```sh
homelab-tui                                        # launch TUI
homelab-tui --config /path/to/homelab.config.json  # use a specific config (session only)
homelab-tui --set-config /path/to/homelab.config.json  # persist config path as default
homelab-tui --update                               # self-update to latest release
homelab-tui --check-update                         # check latest version without installing
homelab-tui --version                              # print version
homelab-tui --help                                 # print help
```

On first launch, a setup wizard lets you create or locate your `homelab.config.json`.

## Config

```json
{
  "hosts": [
    {
      "name": "desktop",
      "host": "192.168.1.20",
      "port": 22,
      "username": "achraf",
      "authMethod": "password",
      "discovery": {
        "docker": true,
        "nativeServices": false,
        "includeStoppedContainers": true
      }
    }
  ]
}
```

| Field | Description |
|---|---|
| `authMethod` | `"password"` (prompted at launch) or `"key"` (SSH private key, supports agent) |
| `group` | Optional label to group hosts in the selector (filter with `g`) |
| `refreshInterval` | Polling interval in ms (default `3000`, min `1000`, max `60000`) |
| `nativeServices` | Discover processes listening on TCP ports (Jellyfin, Ollama, LM Studio, game servers…) |
| `includeStoppedContainers` | Show stopped Docker containers |

## Keyboard shortcuts

### Host selector

| Key | Action |
|-----|--------|
| `↑` / `↓` | Select host |
| `Enter` | Connect to selected host |
| `m` | Multi-host mode (select multiple hosts) |
| `Esc` | Back to previous monitor view (when coming from one) |
| `a` | Add new host |
| `e` | Edit selected host |
| `d` | Delete selected host |

In multi-host mode: `Space` to check/uncheck, `Enter` to open all in split-pane, `Esc` to cancel.

### Monitor

| Key | Action |
|-----|--------|
| `↑` / `↓` | Select service |
| `r` | Restart selected Docker container |
| `s` | Stop selected Docker container / kill selected process |
| `t` | Start selected Docker container |
| `l` | Toggle live log panel |
| `PgUp` / `PgDn` | Scroll log panel |
| `a` | Add another host as a new pane (stays connected) |
| `x` | Close the focused pane |
| `<` / `>` | Move focused pane left / right (swap, connections stay alive) |
| `Tab` / `Shift+Tab` | Switch focused pane |
| `/` | Search by name or image |
| `f` | Cycle filter: all → docker → processes → running → stopped → failed → restarting |
| `o` | Cycle sort: name → status → image |
| `h` | Switch host |
| `q` | Quit |

> Footer hints adapt to selection: Docker shows `r restart · s stop · t start`; processes show `r restart · s kill` (`r` uses systemd on Linux).

## Features

- **Multi-host split-pane** — monitor multiple hosts simultaneously side-by-side; compact per-pane headers with inline metrics; app bar shows all pane statuses; `Tab` to switch focus
- **Host groups** — tag hosts with `"group"` in config; press `g` in the selector to filter by group
- **Configurable refresh interval** — set per-host polling rate (`"refreshInterval": 5000`)
- **Service-down alerts** — audible bell + red banner on running → stopped/failed transitions
- **Disk full warnings** — ⚠ badge on disks above 85%
- **Compose stack restart** — `r` on a Compose service opens a scope picker (container vs whole stack)
- **Config hot-reload** — edit `homelab.config.json` while running; picked up automatically within 150 ms
- **Service health history** — details panel shows last 5 status transitions with timestamps
- **Docker discovery** — containers with status, image, ports, health, Compose project
- **Process discovery** — finds programs listening on TCP ports (Jellyfin, Ollama, LM Studio, game servers…) on Linux, macOS, and Windows
- **Context-aware controls** — Docker: restart/stop/start; discovered processes: kill + restart via systemd (Linux)
- **Live logs** — `docker logs -f` streamed over SSH; discovered processes stream via `journalctl -f` (Linux) or `log stream` (macOS); scrollable with auto-follow
- **System metrics** — CPU %, RAM, disk usage
- **Auth error handling** — wrong password shows an error and re-prompts immediately without leaving the app
- **Auto-reconnect** — SSH keepalive detects silent drops (15 s interval, 3 missed → reconnect); exponential backoff (3 → 5 → 10 → 20 → 30 s); attempt counter shown in header
- **Command timeout** — SSH commands time out after 30 s so a hanging command never blocks the refresh loop
- **Self-update** — `homelab-tui --update` checks version first, skips download if already up to date; otherwise replaces the binary in place with a live progress bar
- **Update notifications** — checks for a newer release on launch using proper semver comparison; shows `↑ vX.Y.Z available` in the app bar only when an actual upgrade exists

## Supported platforms

| Platform | Architecture |
|----------|-------------|
| Linux | x64, arm64 |
| macOS | x64, arm64 (Apple Silicon) |
| Windows | x64 |

## Links

- [GitHub](https://github.com/ACHRAF-YOUSSEF/homelab-tui)
- [Report an issue](https://github.com/ACHRAF-YOUSSEF/homelab-tui/issues)
