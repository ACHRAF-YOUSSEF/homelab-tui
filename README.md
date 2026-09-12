<p align="center">
  <img src="docs/public/logo.svg" width="88" height="88" alt="homelab-tui logo">
</p>

<h1 align="center">homelab-tui</h1>

<p align="center">
  A fast, keyboard-first terminal interface for monitoring and controlling homelab hosts over SSH.
</p>

<p align="center">
  <a href="https://bun.sh"><img src="https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white" alt="Bun"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://opentui.com/"><img src="https://img.shields.io/badge/React%20OpenTUI-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React OpenTUI"></a>
  <a href="https://www.npmjs.com/package/homelab-tui"><img src="https://img.shields.io/npm/v/homelab-tui?style=for-the-badge&logo=npm&logoColor=white" alt="npm version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="MIT license"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Linux-FCC624?style=for-the-badge&logo=linux&logoColor=black" alt="Linux">
  <img src="https://img.shields.io/badge/macOS-000000?style=for-the-badge&logo=apple&logoColor=white" alt="macOS">
  <img src="https://img.shields.io/badge/Windows-0078D4?style=for-the-badge&logo=windows&logoColor=white" alt="Windows">
</p>

<p align="center">
  <a href="https://github.com/ACHRAF-YOUSSEF"><img src="https://img.shields.io/badge/Author-Achraf%20Youssef-181717?style=for-the-badge&logo=github" alt="Author: Achraf Youssef"></a>
  <a href="https://achraf-youssef.github.io/portfolio/"><img src="https://img.shields.io/badge/Portfolio-Visit-blueviolet?style=for-the-badge&logo=firefox" alt="Portfolio"></a>
</p>

<p align="center">
  <a href="https://achraf-youssef.github.io/homelab-tui/">Documentation</a>
  ·
  <a href="https://github.com/ACHRAF-YOUSSEF/homelab-tui/releases">Releases</a>
  ·
  <a href="https://github.com/ACHRAF-YOUSSEF/homelab-tui/issues">Issues</a>
</p>

![homelab-tui multi-host tabs with service monitoring and live logs](assets/logs.png)

homelab-tui connects to Linux, macOS, and Windows hosts over SSH, discovers Docker containers and native services, displays system metrics and logs, and provides guarded service controls from one terminal.

## Features

- **Multi-host monitoring** — keep several independent SSH connections open in full-width host tabs.
- **Docker and Compose discovery** — inspect status, image, ports, health, and Compose projects.
- **Native service discovery** — find programs listening on TCP ports across supported operating systems.
- **System metrics** — monitor CPU, memory, and disk usage without installing a remote agent.
- **Live logs** — follow Docker logs and supported native-process logs over SSH.
- **Keyboard-first controls** — search, filter, sort, restart, stop, start, and switch tabs without a mouse.
- **Resilient connections** — keep healthy hosts usable while another host reconnects or fails.
- **Secure authentication** — use passwords, private keys, encrypted keys, or an SSH agent.
- **Self-update support** — check for and install new GitHub releases from the CLI.

## Install

### npm

```sh
npm install -g homelab-tui
homelab-tui
```

The npm package installs the compiled binary for your operating system and CPU architecture. Bun is not required after installation.

### Bun

Bun requires packages with lifecycle scripts to be trusted:

```sh
bun add -g homelab-tui
bun pm trust homelab-tui
bun add -g homelab-tui
```

### Prebuilt binary

Download the latest binary from [GitHub Releases](https://github.com/ACHRAF-YOUSSEF/homelab-tui/releases).

| Platform | File |
|---|---|
| Linux x64 | `homelab-tui-linux-x64` |
| Linux arm64 | `homelab-tui-linux-arm64` |
| macOS Intel | `homelab-tui-darwin-x64` |
| macOS Apple Silicon | `homelab-tui-darwin-arm64` |
| Windows x64 | `homelab-tui-windows-x64.exe` |

### Build from source

```sh
git clone https://github.com/ACHRAF-YOUSSEF/homelab-tui.git
cd homelab-tui
bun install
bun run dev
```

## Quick start

Create `homelab.config.json`:

```json
{
  "hosts": [
    {
      "name": "server",
      "host": "192.168.1.10",
      "port": 22,
      "username": "admin",
      "authMethod": "key",
      "privateKeyPath": "~/.ssh/id_ed25519",
      "group": "home",
      "refreshInterval": 3000,
      "discovery": {
        "docker": true,
        "nativeServices": true,
        "includeStoppedContainers": true
      }
    }
  ]
}
```

Then launch:

```sh
homelab-tui
```

Passwords and private-key passphrases are prompted at launch and are never stored in the configuration file. See the [configuration guide](https://achraf-youssef.github.io/homelab-tui/guide/configuration) for every field and default.

## Usage

| Key | Action |
|---|---|
| `↑` / `↓` | Select a host or service |
| `Enter` | Connect or confirm |
| `Tab` / `Shift+Tab` | Open the next or previous host tab |
| `1`–`9` | Open a host tab directly |
| `/` | Search services |
| `f` | Cycle filters |
| `o` | Cycle sorting |
| `r` | Restart the selected service, or reconnect the focused offline host |
| `c` | Reopen the credential prompt for the focused host |
| `s` | Stop a container or kill a native process |
| `t` | Start a Docker container |
| `l` | Toggle live logs |
| `a` / `x` | Add or close a host tab |
| `h` | Return to the host selector |
| `q` | Quit |

The footer uses the same key definitions as the input handlers and adapts to the selected service. See the complete [keybinding reference](https://achraf-youssef.github.io/homelab-tui/guide/keybindings).

## Command line

| Option | Description |
|---|---|
| `--config <path>`, `-c <path>` | Use a configuration file for this run |
| `--set-config <path>` | Save the default configuration path |
| `--check-update` | Compare the installed and latest versions |
| `--update` | Download and install the latest release |
| `--version`, `-v` | Print the installed version |
| `--help`, `-h` | Print command help |

## Supported hosts

| Capability | Linux | macOS | Windows |
|---|:---:|:---:|:---:|
| System metrics | ✓ | ✓ | ✓ |
| Docker containers | ✓ | ✓ | ✓ |
| Native process discovery | ✓ | ✓ | ✓ |
| Native log streaming | `journalctl` | `log stream` | — |
| Native process restart | systemd | — | — |

Remote hosts need an SSH server and standard system utilities. Docker is only required for container discovery and controls. Windows hosts require [OpenSSH Server](https://learn.microsoft.com/windows-server/administration/openssh/openssh_install_firstuse).

## Documentation

- [Installation](https://achraf-youssef.github.io/homelab-tui/guide/install)
- [Configuration](https://achraf-youssef.github.io/homelab-tui/guide/configuration)
- [Monitoring](https://achraf-youssef.github.io/homelab-tui/guide/monitoring)
- [Keybindings](https://achraf-youssef.github.io/homelab-tui/guide/keybindings)
- [Command line](https://achraf-youssef.github.io/homelab-tui/guide/cli)
- [Troubleshooting](https://achraf-youssef.github.io/homelab-tui/guide/troubleshooting)

## Built With

- [Bun](https://bun.sh/) — runtime, package manager, test runner, and native binary compiler
- [TypeScript](https://www.typescriptlang.org/) — strict application code
- [React](https://react.dev/) — declarative interface components
- [OpenTUI](https://opentui.com/) — native terminal renderer with React bindings
- [node-ssh](https://github.com/steelbrain/node-ssh) — SSH connections, commands, and log streams
- [Zod](https://zod.dev/) — configuration validation
- [VitePress](https://vitepress.dev/) — documentation site

## Development

```sh
bun install
bun run dev
bun test
bunx tsc --noEmit
bun run build:linux-x64
bun run docs:dev
```

Contributions are welcome. Please open an issue before a large behavioral change and run the relevant checks before submitting a pull request.

## License

homelab-tui is released under the [MIT License](LICENSE).

Copyright © 2026 [Achraf Youssef](https://github.com/ACHRAF-YOUSSEF).

## Star History

<a href="https://www.star-history.com/?repos=ACHRAF-YOUSSEF%2Fhomelab-tui&type=timeline&legend=top-left">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=ACHRAF-YOUSSEF/homelab-tui&type=timeline&theme=dark&logscale&legend=top-left">
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=ACHRAF-YOUSSEF/homelab-tui&type=timeline&logscale&legend=top-left">
    <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=ACHRAF-YOUSSEF/homelab-tui&type=timeline&logscale&legend=top-left">
  </picture>
</a>
