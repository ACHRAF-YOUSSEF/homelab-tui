# homelab-tui

Terminal UI for monitoring a remote homelab server over SSH. Discovers Docker containers, streams live logs, and shows system metrics. Supports Linux, macOS, and Windows remote hosts.

## Install

```sh
npm install -g homelab-tui
```

The correct binary for your platform is downloaded automatically on install.

## Usage

```sh
homelab-tui                            # launch TUI
homelab-tui --config /path/to/config  # use a specific config file (session only)
homelab-tui --set-config /path/to/config  # persist config path as default
homelab-tui --update                   # self-update to latest release
homelab-tui --version                  # print version
homelab-tui --help                     # print help
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

`authMethod` can be `"password"` (prompted at launch) or `"key"` (SSH private key, supports agent).

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `↑` / `↓` | Select service |
| `r` | Restart container |
| `s` | Stop container |
| `t` | Start container |
| `l` | Toggle live logs |
| `/` | Search by name or image |
| `f` | Cycle status filter |
| `o` | Cycle sort order |
| `h` | Switch host |
| `q` | Quit |

## Supported platforms

| Platform | Architecture |
|----------|-------------|
| Linux | x64, arm64 |
| macOS | x64, arm64 (Apple Silicon) |
| Windows | x64 |

## Links

- [GitHub](https://github.com/ACHRAF-YOUSSEF/homelab-tui)
- [Report an issue](https://github.com/ACHRAF-YOUSSEF/homelab-tui/issues)
