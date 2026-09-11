# Command line

```text
homelab-tui [options]
```

| Option | Description |
|---|---|
| `--config <path>`, `-c <path>` | Use a config file for this run only. |
| `--set-config <path>` | Save a config path as the default. |
| `--update` | Download and install the latest GitHub release. |
| `--check-update` | Print the latest and current versions without installing. |
| `--version`, `-v` | Print the installed version. |
| `--help`, `-h` | Print command help. |

## Examples

```sh
# Launch with the resolved default config
homelab-tui

# Use a separate lab configuration once
homelab-tui -c ./configs/lab.json

# Make that path the default
homelab-tui --set-config ./configs/lab.json

# Check before updating
homelab-tui --check-update
homelab-tui --update
```

Config resolution follows this order:

1. `--config` or `-c` for the current run.
2. The path saved by `--set-config`.
3. `homelab.config.json` in the current working directory.
