# Monitoring

## Open hosts

Select one host and press `Enter`, or press `m` to choose several hosts before connecting. Each selected host gets its own pane and SSH connection.

The top bar summarizes the whole session:

- Healthy hosts remain usable when another host fails.
- Connecting and reconnecting hosts show their current state.
- Failed panes show a specific SSH error and recovery action without replacing healthy panes.
- `Tab` and `Shift+Tab` move focus between panes.

![Three host panes with healthy, empty, and reconnecting states](/terminal-200x50.png)

## Read a pane

Each pane contains the host state and a service list. The focused pane has the stronger border and owns selection, search, filter, sort, and service actions.

For a healthy host, the TUI can show:

- CPU, RAM, and disk usage.
- Docker and Compose container status, image, ports, and health.
- Native programs listening on TCP ports.
- Recent status transitions for the selected service.
- A service-down alert when a running service becomes stopped or failed.

At `80×24`, metrics and full details collapse into a compact layout while selection and primary actions remain visible. Wider terminals add columns and allow more panes.

## Logs

Press `l` to open or close logs for the selected service. Docker logs stream with follow mode. Linux native-process logs use `journalctl`; macOS uses `log stream`. Native log streaming is not available on Windows.

Use the arrow or page keys to move away from the newest line. Move back to the bottom to resume follow mode.

## Service actions

| Service | Restart | Stop | Start |
|---|---|---|---|
| Docker container | `r` | `s` | `t` |
| Compose container | `r` opens a scope picker | `s` | `t` |
| Native process | `r` for systemd-managed Linux processes | `s` kills the process | Not available |

When restarting a Compose service, choose `1` or `Enter` for only the selected container, or `2` for the entire Compose stack.

## Reconnecting

SSH keepalives detect a dropped connection and retry after `3`, `5`, `10`, `20`, then `30` seconds. The retry count and countdown remain visible, and `r` retries immediately. A successful snapshot clears the reconnect state automatically.

Only transient network failures retry automatically. Credential and configuration failures pause with contextual `c credentials` or `h hosts` actions. A disconnected pane labels its last successful update as stale and disables service actions until it recovers.
