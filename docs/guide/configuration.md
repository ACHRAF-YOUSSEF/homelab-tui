# Configuration

homelab-tui reads a JSON file containing one or more SSH hosts. The default path is `homelab.config.json` in the current directory.

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
    },
    {
      "name": "desktop",
      "host": "192.168.1.20",
      "port": 22,
      "username": "operator",
      "authMethod": "password",
      "discovery": {
        "docker": false,
        "nativeServices": true,
        "includeStoppedContainers": false
      }
    }
  ]
}
```

## Host fields

| Field | Required | Default | Description |
|---|---:|---:|---|
| `name` | Yes | — | Label shown in the host selector and host tab. |
| `host` | Yes | — | Hostname or IP address accepted by SSH. |
| `port` | No | `22` | SSH port from `1` to `65535`. |
| `username` | Yes | — | Remote SSH user. |
| `authMethod` | No | `"key"` | `"key"` or `"password"`. |
| `privateKeyPath` | For key auth | — | Path to the SSH private key. SSH agent keys are also supported. |
| `group` | No | — | Label used by the host selector's group filter. |
| `refreshInterval` | No | `3000` | Polling interval in milliseconds, from `1000` to `60000`. |
| `discovery.docker` | No | `true` | Discover Docker and Compose containers. |
| `discovery.nativeServices` | No | `false` | Discover programs listening on TCP ports. |
| `discovery.includeStoppedContainers` | No | `true` | Include stopped Docker containers. |

::: warning Credentials
Passwords and key passphrases are prompted at launch and are not stored in the JSON configuration. Do not put secrets in this file.
:::

## Choose another config file

Use a path for one run:

```sh
homelab-tui --config /path/to/homelab.config.json
```

Save a path as the default for future runs:

```sh
homelab-tui --set-config /path/to/homelab.config.json
```

The saved setting lives at `~/.config/homelab-tui/settings.json` on Linux and macOS, or `%APPDATA%\homelab-tui\settings.json` on Windows. An explicit `--config` path always wins.

Configuration changes are reloaded while the host selector or monitor is open. Existing connections stay alive until their tab is removed or the view changes.
