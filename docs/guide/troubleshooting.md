# Troubleshooting

## The config is rejected

homelab-tui prints the invalid field path before exiting. Check that the file is valid JSON, required strings are not empty, the SSH port is between `1` and `65535`, and `privateKeyPath` is present for key authentication.

Use `--config` to confirm which file you are testing:

```sh
homelab-tui --config /absolute/path/to/homelab.config.json
```

## SSH authentication fails

- Confirm the host, port, username, and authentication method with `ssh` first.
- For key auth, check the private-key path and file permissions.
- Add the key to your SSH agent if it is agent-managed.
- Encrypted keys prompt for a passphrase; password hosts prompt on launch.
- A rejected password opens a fresh prompt instead of storing the failed value.

## A host keeps reconnecting

Connection errors trigger retries with increasing delays up to 30 seconds. Check network reachability, the remote SSH service, and any idle-session firewall rules. Other healthy panes continue refreshing during a partial failure.

## Docker services are missing

Run `docker ps` as the configured remote user. Docker must be installed, the daemon must be running, and the user must have permission to access it. Also verify that `discovery.docker` is `true`.

Stopped containers only appear when `discovery.includeStoppedContainers` is `true`.

## Native processes or logs are missing

Set `discovery.nativeServices` to `true`. Process discovery reports programs listening on TCP ports, not every process on the machine.

Native logs depend on platform tools:

- Linux: `journalctl` for the selected PID.
- macOS: `log stream` for the selected PID.
- Windows: native log streaming is unavailable.

Restarting a native process is supported only when Linux systemd manages that process. Killing a process is supported on all remote platforms.

## Enable OpenSSH Server on Windows

Run PowerShell as Administrator on the remote Windows host:

```powershell
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
Start-Service sshd
Set-Service -Name sshd -StartupType Automatic
```

To use a key, add the public key to the remote account's authorized keys file:

```powershell
$authorizedKeysPath = "$env:USERPROFILE\.ssh\authorized_keys"
New-Item -Force -ItemType Directory (Split-Path $authorizedKeysPath)
Add-Content $authorizedKeysPath "ssh-ed25519 AAAA... your-public-key"
```

## The layout is too dense

Use at least an `80×24` terminal. The TUI switches to a compact layout below 30 rows; wider terminals reveal more service columns and make multi-host panes easier to scan.
