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
| `nativeServices` | Discover processes listening on TCP ports (Jellyfin, Ollama, LM Studio, game servers…) |
| `includeStoppedContainers` | Show stopped Docker containers |

## Keyboard shortcuts

### Host selector

| Key | Action |
|-----|--------|
| `↑` / `↓` | Select host |
| `Enter` | Connect to selected host |
| `m` | Multi-host mode (select multiple hosts) |
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
| `Tab` / `Shift+Tab` | Switch focused pane |
| `/` | Search by name or image |
| `f` | Cycle filter: all → docker → processes → running → stopped → failed → restarting |
| `o` | Cycle sort: name → status → image |
| `h` | Switch host |
| `q` | Quit |

> Footer hints adapt to selection: Docker shows `r restart · s stop · t start`, processes show `s kill` only.

## Features

- **Multi-host split-pane** — monitor multiple hosts simultaneously side-by-side; compact per-pane headers with inline metrics; app bar shows all pane statuses; `Tab` to switch focus
- **Docker discovery** — containers with status, image, ports, health, Compose project
- **Process discovery** — finds programs listening on TCP ports (Jellyfin, Ollama, LM Studio, game servers…) on Linux, macOS, and Windows
- **Context-aware controls** — Docker: restart/stop/start; discovered processes: kill only
- **Live logs** — `docker logs -f` streamed over SSH, scrollable, auto-follows new output
- **System metrics** — CPU %, RAM, disk usage
- **Auto-reconnect** — automatically reconnects when SSH drops
- **Self-update** — `homelab-tui --update` replaces the binary in place with a live download progress bar
- **Update notifications** — checks for a new release on launch; shows `↑ vX.Y.Z available` in the header if one is found

## Supported platforms

| Platform | Architecture |
|----------|-------------|
| Linux | x64, arm64 |
| macOS | x64, arm64 (Apple Silicon) |
| Windows | x64 |

## Links

- [GitHub](https://github.com/ACHRAF-YOUSSEF/homelab-tui)
- [Report an issue](https://github.com/ACHRAF-YOUSSEF/homelab-tui/issues)
