# homelab-tui

Terminal UI for monitoring a remote homelab server over SSH. Discovers Docker containers and running programs (Jellyfin, Ollama, LM Studio, game servers…), streams live logs, and shows system metrics. Supports Linux, macOS, and Windows remote hosts.

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
| `Enter` | Connect |
| `a` | Add new host |
| `e` | Edit selected host |
| `d` | Delete selected host |

### Monitor

| Key | Action |
|-----|--------|
| `↑` / `↓` | Select service |
| `r` | Restart selected Docker container |
| `s` | Stop selected Docker container / kill selected process |
| `t` | Start selected Docker container |
| `l` | Toggle live log panel |
| `PgUp` / `PgDn` | Scroll log panel |
| `/` | Search by name or image |
| `f` | Cycle filter: all → docker → processes → running → stopped → failed → restarting |
| `o` | Cycle sort: name → status → image |
| `h` | Switch host |
| `q` | Quit |

> Footer hints adapt to selection: Docker shows `r restart · s stop · t start`, processes show `s kill` only.

## Features

- **Multi-host** — add, edit, delete hosts at runtime
- **Docker discovery** — containers with status, image, ports, health, Compose project
- **Process discovery** — finds programs listening on TCP ports (Jellyfin, Ollama, LM Studio, game servers…) on Linux, macOS, and Windows
- **Context-aware controls** — Docker: restart/stop/start; discovered processes: kill only
- **Live logs** — `docker logs -f` streamed over SSH, scrollable, auto-follows new output
- **System metrics** — CPU %, RAM, disk usage
- **Auto-reconnect** — automatically reconnects when SSH drops
- **Self-update** — `homelab-tui --update` replaces the binary in place

## Supported platforms

| Platform | Architecture |
|----------|-------------|
| Linux | x64, arm64 |
| macOS | x64, arm64 (Apple Silicon) |
| Windows | x64 |

## Links

- [GitHub](https://github.com/ACHRAF-YOUSSEF/homelab-tui)
- [Report an issue](https://github.com/ACHRAF-YOUSSEF/homelab-tui/issues)
