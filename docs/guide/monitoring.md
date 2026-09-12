# Monitoring

## Open hosts

Select one host and press `Enter`, or press `m` to choose several hosts before connecting. Each selected host gets its own tab and SSH connection.

From the monitor, press `a` to add tabs. The picker can add one or several configured hosts, or create and save a new host without losing hosts already checked in that add operation. Press `Esc` to cancel the operation, or `Enter` to add the checked hosts.

The top bar summarizes the whole session:

- Healthy hosts remain usable when another host fails.
- Connecting and reconnecting hosts show their current state.
- Failed tabs show a specific SSH error and recovery action without replacing healthy hosts.
- `Tab` and `Shift+Tab` cycle every tab; number keys `1`–`9` open the first nine directly. There is no nine-tab limit.

## Read a tab

Each tab contains the host state and a full-width service list. Only the active tab owns selection, search, filter, sort, and service actions; inactive hosts stay connected and continue refreshing.

For a healthy host, the TUI can show:

- CPU, RAM, and disk usage.
- Docker and Compose container status, image, ports, and health.
- Native programs listening on TCP ports.
- Recent status transitions for the selected service.
- A service-down alert when a running service becomes stopped or failed.

At `80×24`, metrics and full details collapse into a compact layout while selection and primary actions remain visible. Wider terminals add service columns. Long tab lists scroll around the active host instead of overflowing.

## Terminals

Press `v` on an online host to replace the service view with an interactive SSH shell. Use the `Ctrl+B` prefix shown in the footer to open, select, reorder, or close shells, switch host tabs, or return to service details. Every host keeps its own shells and active shell when you switch tabs. Shells remain open until you close their host tab or leave the monitor.

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

The TUI probes the configured SSH endpoint every 3 seconds. A refused connection, including a stopped SSH listener, fails the tab immediately; ambiguous network failures require two consecutive probes. Command health checks and SSH keepalives cover established sessions that hang. The tab keeps its last snapshot as stale and waits for `r` to reconnect or `x` to disconnect and close the tab.

Transient failures during the initial connection retry after `3`, `5`, `10`, `20`, then `30` seconds. Credential and configuration failures pause with contextual `c credentials` or `h hosts` actions. A successful snapshot clears the reconnect state automatically.
