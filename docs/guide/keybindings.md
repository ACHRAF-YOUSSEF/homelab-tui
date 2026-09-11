# Keybindings

## Host selector

| Key | Action |
|---|---|
| `↑` / `↓` | Select a host. |
| `Enter` | Connect to the selected host. |
| `m` | Enter multi-host selection. |
| `g` | Cycle configured host groups. |
| `a` | Add a host. |
| `e` | Edit the selected host. |
| `d` | Delete the selected host. |
| `Esc` | Return to the previous monitor when available. |

In multi-host selection, use `Space` to check hosts, `Enter` to connect to the checked hosts, and `Esc` to cancel.

## Add or edit a host

| Key | Action |
|---|---|
| `↑` / `↓` / `Tab` | Move between fields. |
| `Shift+Tab` | Move to the previous field. |
| `Space` | Toggle discovery and authentication choices. |
| `Enter` | Confirm a field or save. |
| `Esc` | Cancel, or quit during first-run setup. |

## Monitor

| Key | Action |
|---|---|
| `↑` / `↓` | Select a service. |
| `r` | Restart the selected service. |
| `s` | Stop a Docker container or kill a native process. |
| `t` | Start a Docker container. |
| `l` | Toggle live logs. |
| `/` | Search by service name or image. |
| `f` | Cycle type and status filters. |
| `o` | Cycle sorting by name, status, and image. |
| `a` | Add another host pane. |
| `x` | Close the focused pane. |
| `<` / `>` | Move the focused pane left or right. |
| `Tab` / `Shift+Tab` | Focus the next or previous pane. |
| `h` | Return to the host selector. |
| `q` | Quit. |

The footer uses the same central key definitions as the handlers, so its visible shortcuts follow the active service type. Compact terminals show the primary subset.

## Logs

| Key | Action |
|---|---|
| `↑` / `↓` | Scroll one line. |
| `PgUp` / `PgDn` | Scroll one page. |
| `l` | Close the log panel. |

## Compose restart picker

| Key | Action |
|---|---|
| `1` / `Enter` | Restart only the selected container. |
| `2` | Restart the entire Compose stack. |
| `Esc` | Cancel. |
