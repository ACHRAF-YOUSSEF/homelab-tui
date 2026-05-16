# homelab-tui

Terminal UI for monitoring a remote homelab server over SSH. Discovers Docker containers and shows system metrics. Supports Linux, macOS, and Windows remote hosts.

## Requirements

- [Bun](https://bun.sh) ≥ 1.0
- SSH key-based access to remote host (no password auth)
- Docker installed on remote host (for container discovery)

## Installation

```sh
git clone https://github.com/yourname/homelab-tui
cd homelab-tui
bun install
```

## Config

Create `homelab.config.json` in the project root (already provided as example):

```json
{
  "hosts": [
    {
      "name": "desktop",
      "host": "192.168.1.20",
      "port": 22,
      "username": "achraf",
      "privateKeyPath": "~/.ssh/id_ed25519",
      "discovery": {
        "docker": true,
        "nativeServices": false,
        "includeStoppedContainers": true
      }
    }
  ]
}
```

Only the first host is used in this MVP. `nativeServices` is accepted but not yet implemented.

## Running

```sh
bun dev
# or
bun start
```

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `↑` / `↓` | Select service |
| `r` | Restart selected container |
| `s` | Stop selected container |
| `t` | Start selected container |
| `l` | Load last 100 log lines |
| `L` | Close log panel |
| `q` | Quit |

## Enabling OpenSSH on Windows (remote host)

Open PowerShell as Administrator:

```powershell
# Install OpenSSH server
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0

# Start and auto-start the service
Start-Service sshd
Set-Service -Name sshd -StartupType Automatic

# Add your public key
$authorizedKeysPath = "$env:USERPROFILE\.ssh\authorized_keys"
New-Item -Force -ItemType Directory (Split-Path $authorizedKeysPath)
Add-Content $authorizedKeysPath "ssh-ed25519 AAAA... your-public-key"
```

Then confirm `sshd` is running and port 22 is open in Windows Firewall.

## MVP Limitations

- Only the first host in `hosts[]` is monitored
- `nativeServices` (systemd / Windows services) not yet implemented
- No multi-host switching in the UI
- Docker actions run at the container level (not `docker compose up/down`)
- Log panel shows stdout only; stderr may be mixed in depending on container
- CPU usage on Linux requires two `/proc/stat` reads 500 ms apart — adds latency on first load
- No reconnect logic: if SSH drops, restart the TUI
