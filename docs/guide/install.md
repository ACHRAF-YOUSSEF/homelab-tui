# Install

## npm

The npm package installs the binary for your operating system and CPU architecture:

```sh
npm install -g homelab-tui
homelab-tui
```

No Bun runtime is needed after installation.

## Bun

Bun blocks package lifecycle scripts until the package is trusted. Install, trust, and install once more so the platform binary is selected:

```sh
bun add -g homelab-tui
bun pm trust homelab-tui
bun add -g homelab-tui
```

## Download a binary

Download the latest build from [GitHub Releases](https://github.com/ACHRAF-YOUSSEF/homelab-tui/releases).

| Platform | Release file |
|---|---|
| Linux x64 | `homelab-tui-linux-x64` |
| Linux arm64 | `homelab-tui-linux-arm64` |
| macOS Intel | `homelab-tui-darwin-x64` |
| macOS Apple Silicon | `homelab-tui-darwin-arm64` |
| Windows x64 | `homelab-tui-windows-x64.exe` |

On Linux or macOS, make the downloaded file executable and place it on your `PATH`:

```sh
chmod +x homelab-tui-linux-x64
sudo mv homelab-tui-linux-x64 /usr/local/bin/homelab-tui
```

## Run from source

[Bun](https://bun.sh/) is required when running the TypeScript source directly:

```sh
git clone https://github.com/ACHRAF-YOUSSEF/homelab-tui.git
cd homelab-tui
bun install
bun run dev
```

## Remote host requirements

- SSH access using a password, private key, or SSH agent.
- Docker on the remote host if you want container discovery and controls.
- Standard system tools for metrics and process discovery.
- OpenSSH Server enabled when the remote host is Windows.

On first launch, homelab-tui offers to create `homelab.config.json` or use an existing configuration file. Continue with [Configuration](./configuration).
