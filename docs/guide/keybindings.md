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
| `a` | Add another host tab. |
| `x` | Close the active tab. |
| `Tab` / `Shift+Tab` | Open the next or previous tab. |
| `1`–`9` | Open a host tab directly. |
| `h` | Return to the host selector. |
| `q` | Quit. |

The add-tab picker starts in multi-select mode. Use `Space` to check or uncheck configured hosts, `Enter` to add every checked host (or the focused host when none are checked), and `n` or the final list item to create a host. A newly created host is saved and checked without clearing the current selection. `Esc` cancels the whole add operation; selection is otherwise cleared only after the checked hosts are added.

Tabs are not capped at nine. Number keys open tabs `1`–`9` directly; `Tab` and `Shift+Tab` reach every tab, and long tab lists scroll around the active host.

The footer uses the same central key definitions as the handlers, so its visible shortcuts follow the active service type. Compact terminals show the primary subset.

When the focused host is not online, the footer switches to connection recovery actions:

| Key | Action |
|---|---|
| `r` | Reconnect immediately when retrying, disconnected, or offline. |
| `x` | Disconnect and close a dropped host tab. |
| `c` | Reopen the password or passphrase prompt when credentials are required. |
| `h` | Return to the host selector to edit the host configuration. |
| `Esc` | Close a credential prompt without hiding the host failure. |

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
