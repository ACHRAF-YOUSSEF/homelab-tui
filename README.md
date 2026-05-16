# homelab-tui

Terminal UI for monitoring a remote homelab server over SSH. Discovers Docker containers, streams live logs, and shows system metrics. Supports Linux, macOS, and Windows remote hosts.

## Requirements

- [Bun](https://bun.sh) ≥ 1.0
- SSH access to remote host (password or private key)
- Docker installed on remote host (for container discovery)

## Installation

### npm / bun (recommended)

```sh
npm install -g homelab-tui
# or
bun add -g homelab-tui
```

This automatically downloads the pre-built binary for your platform (Linux x64/arm64, macOS x64/arm64, Windows x64). No Bun runtime needed after install.

### Download a binary manually

Download the latest binary for your platform from [Releases](https://github.com/ACHRAF-YOUSSEF/homelab-tui/releases):

| Platform | File |
|---|---|
| Linux x64 | `homelab-tui-linux-x64` |
| Linux arm64 | `homelab-tui-linux-arm64` |
| macOS x64 | `homelab-tui-darwin-x64` |
| macOS arm64 (M-series) | `homelab-tui-darwin-arm64` |
| Windows x64 | `homelab-tui-windows-x64.exe` |

```sh
# Linux / macOS
chmod +x homelab-tui-linux-x64
mv homelab-tui-linux-x64 /usr/local/bin/homelab-tui

# Windows — add to a folder in your PATH
```

### From source (requires Bun)

```sh
git clone https://github.com/ACHRAF-YOUSSEF/homelab-tui
cd homelab-tui
bun install
```

## Config

Create `homelab.config.json` in the project root:

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

### Auth methods

| `authMethod` | Required fields | Notes |
|---|---|---|
| `"password"` | — | Prompted at launch, never stored |
| `"key"` | `privateKeyPath` | Supports SSH agent (`SSH_AUTH_SOCK`), passphrase prompted if key is encrypted |

## CLI

```sh
homelab-tui                        # launch TUI
homelab-tui --config /path/to/homelab.config.json  # use a specific config (session only)
homelab-tui --set-config /path/to/homelab.config.json  # persist config path as default
homelab-tui --update               # self-update to latest GitHub release
homelab-tui --check-update         # check latest version without installing
homelab-tui --version              # print version
homelab-tui --help                 # print help

# From source
bun dev
```

On first launch with no config file, a setup screen lets you create one or point to an existing path. The chosen path is saved to `~/.config/homelab-tui/settings.json` (Windows: `%APPDATA%\homelab-tui\settings.json`) so future launches find it automatically.

## Screens

### Host selector
Shown on startup when hosts exist. Lists all configured hosts.

| Key | Action |
|-----|--------|
| `↑` / `↓` | Select host |
| `Enter` | Connect |
| `a` | Add new host |
| `d` | Delete selected host |

### Add host form
Shown on first launch or when pressing `a` in the selector.

| Key | Action |
|-----|--------|
| `↑` / `↓` / `Tab` | Navigate fields (wraps) |
| `Space` | Toggle boolean / auth method |
| `Enter` | Confirm field / save |
| `Esc` | Cancel (or quit on first run) |
| `q` | Quit |

### Monitor
Main view showing system info, services, and optional log panel.

| Key | Action |
|-----|--------|
| `↑` / `↓` | Select service (or scroll logs when log panel is open) |
| `r` | Restart selected container |
| `s` | Stop selected container |
| `t` | Start selected container |
| `l` | Toggle live log panel |
| `PgUp` / `PgDn` | Scroll log panel |
| `/` | Enter search mode (filter by name or image) |
| `f` | Cycle status filter: all → running → stopped → failed → restarting |
| `o` | Cycle sort: name → status → image |
| `h` | Back to host selector |
| `q` | Quit |

## Features

- **Multi-host** — add/remove hosts at runtime, config auto-saved to `homelab.config.json`
- **OS detection** — auto-detects Linux, macOS, Windows over SSH
- **Docker discovery** — lists all containers (running and stopped) with status, image, ports
- **Live logs** — `docker logs -f` streamed over SSH, scrollable, auto-follows new lines
- **System metrics** — CPU %, RAM, disk usage with progress bars
- **Search / filter / sort** — filter by status, sort by name/status/image, search by name or image
- **Password & key auth** — password prompted securely at runtime; SSH agent supported for keys

## Enabling OpenSSH on Windows (remote host)

Open PowerShell as Administrator:

```powershell
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
Start-Service sshd
Set-Service -Name sshd -StartupType Automatic

# Add your public key
$authorizedKeysPath = "$env:USERPROFILE\.ssh\authorized_keys"
New-Item -Force -ItemType Directory (Split-Path $authorizedKeysPath)
Add-Content $authorizedKeysPath "ssh-ed25519 AAAA... your-public-key"
```

## Known Limitations

- Only one host monitored at a time (no split-pane multi-host view)
- `nativeServices` (systemd / Windows Services) not yet implemented
- CPU usage on Linux requires two `/proc/stat` reads 200 ms apart — runs in parallel with Docker discovery so rarely adds latency

## Star History

<a href="https://www.star-history.com/?repos=ACHRAF-YOUSSEF%2Fhomelab-tui&type=timeline&legend=top-left">
    <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=ACHRAF-YOUSSEF/homelab-tui&type=timeline&theme=dark&legend=top-left" />
        <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=ACHRAF-YOUSSEF/homelab-tui&type=timeline&legend=top-left" />
        <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=ACHRAF-YOUSSEF/homelab-tui&type=timeline&legend=top-left" />
    </picture>
</a>
