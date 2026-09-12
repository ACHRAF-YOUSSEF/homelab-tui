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
- A rejected password pauses automatic retries without storing the failed value. A single tab opens a fresh prompt immediately; in a multi-host view, open the failed tab and press `c` so healthy hosts remain usable. Press `Esc` to close the prompt without hiding the failure.
- A rejected key never opens a password prompt. Check the public key in the remote account's `authorized_keys` file instead.

## A host keeps reconnecting

Transient errors during the initial connection trigger retries after `3`, `5`, `10`, `20`, then `30` seconds. After a connected host drops, press `r` to reconnect or `x` to disconnect and close its tab. Authentication, private-key, DNS, and host-key failures pause instead of retrying forever.

The tab explains the detected failure and keeps other hosts usable. If it had connected before, it also shows the time and service count from the last good update as stale; service actions stay disabled until the connection recovers.

## SSH connection is refused

“Connection refused” means the target actively rejected the TCP connection. From the client alone, homelab-tui cannot tell whether SSH is disabled, the SSH service is stopped, the configured port is wrong, or a firewall is rejecting it. Check all four, then press `r` to retry.

Timeout and “host unreachable” messages usually indicate routing, VPN, firewall, or power-state problems. “Host not found” indicates a hostname or DNS problem.

Host-key failures never retry automatically. Verify the remote host identity before changing a trusted key.

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

Use at least an `80×24` terminal. The TUI switches to a compact layout below 30 rows; wider terminals reveal more service columns while every host tab keeps the full content width.
