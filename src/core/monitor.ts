import { SSHConnectionError, SSHTransport } from "../transports/ssh.js";
import type { ConnectOptions, RemoteShell, ShellSize } from "../transports/ssh.js";
import { detectRemoteOS } from "./os-detect.js";
import { getDockerServices, streamDockerLogs } from "../adapters/docker.js";
import { nativeLogCommand, nativeLogSnapshot } from "../adapters/native-actions.js";
import type { HostConfig, MonitorSnapshot, SystemInfo, RemoteOS, Service } from "./types.js";

export { PassphraseRequiredError } from "../transports/ssh.js";

const REFRESH_COMMAND_TIMEOUT = 5_000;
const HEALTH_TOKEN = "__homelab_tui_alive__";

async function verifyConnection(run: (cmd: string) => Promise<string>, os: RemoteOS): Promise<void> {
  const command = os === "windows"
    ? `powershell -NoProfile -Command "Write-Output '${HEALTH_TOKEN}'"`
    : `printf '${HEALTH_TOKEN}'`;
  if (await run(command) !== HEALTH_TOKEN) {
    throw new SSHConnectionError("disconnected", "Connection lost: remote health check failed", true);
  }
}

async function getSystemInfo(
  run: (cmd: string) => Promise<string>,
  os: RemoteOS,
  prevCpuStat?: number[]
): Promise<SystemInfo & { cpuStat?: number[] }> {
  if (os === "linux") {
    const { getSystemInfo } = await import("../adapters/linux-system.js");
    return getSystemInfo(run, prevCpuStat);
  }
  if (os === "macos") {
    const { getSystemInfo } = await import("../adapters/macos-system.js");
    return getSystemInfo(run);
  }
  if (os === "windows") {
    const { getSystemInfo } = await import("../adapters/windows-system.js");
    return getSystemInfo(run);
  }
  let hostname = "unknown";
  try { hostname = await run("hostname"); } catch {}
  return { hostname, os };
}

async function getNativeServices(
  run: (cmd: string) => Promise<string>,
  os: RemoteOS
): Promise<Service[]> {
  if (os === "linux") {
    const { getNativeServices } = await import("../adapters/linux-services.js");
    return getNativeServices(run);
  }
  if (os === "macos") {
    const { getNativeServices } = await import("../adapters/macos-services.js");
    return getNativeServices(run);
  }
  if (os === "windows") {
    const { getNativeServices } = await import("../adapters/windows-services.js");
    return getNativeServices(run);
  }
  return [];
}

export class Monitor {
  private readonly transport: SSHTransport;
  private readonly cfg: HostConfig;
  private lastOS: RemoteOS = "unknown";
  private linuxCpuStat: number[] | undefined;
  private readonly onDisconnectCb?: () => void;

  constructor(cfg: HostConfig, onDisconnect?: () => void) {
    this.cfg = cfg;
    this.onDisconnectCb = onDisconnect;
    this.transport = new SSHTransport({
      host: cfg.host,
      port: cfg.port,
      username: cfg.username,
      authMethod: cfg.authMethod,
      privateKeyPath: cfg.privateKeyPath,
    }, onDisconnect);
  }

  async connect(opts: ConnectOptions = {}): Promise<void> {
    await this.transport.connect(opts);
  }

  async reconnect(opts: ConnectOptions = {}): Promise<void> {
    this.lastOS = "unknown";
    this.linuxCpuStat = undefined;
    await this.transport.reconnect(opts);
  }

  run(cmd: string): Promise<string> {
    return this.transport.run(cmd);
  }

  openShell(
    size: ShellSize,
    onData: (chunk: Uint8Array) => void,
    onClose?: (error?: Error) => void,
  ): Promise<RemoteShell> {
    return this.transport.openShell(size, onData, onClose);
  }

  async dispose(): Promise<void> {
    await this.transport.dispose();
  }

  async refresh(): Promise<MonitorSnapshot> {
    const run = (cmd: string) => this.transport.run(cmd, REFRESH_COMMAND_TIMEOUT);
    try {
      const remoteOS = this.lastOS === "unknown" ? await detectRemoteOS(run) : this.lastOS;
      if (remoteOS === "unknown") {
        throw new SSHConnectionError("disconnected", "Connection lost: remote host did not answer the OS probe", true);
      }
      await verifyConnection(run, remoteOS);

      const [systemResult, dockerServices, nativeSvcs] = await Promise.all([
        getSystemInfo(run, remoteOS, this.linuxCpuStat),
        this.cfg.discovery.docker ? getDockerServices(run) : Promise.resolve([]),
        this.cfg.discovery.nativeServices ? getNativeServices(run, remoteOS) : Promise.resolve([]),
      ]);
      if (!systemResult.hostname || systemResult.hostname === "unknown") {
        throw new SSHConnectionError("disconnected", "Connection lost: remote hostname probe failed", true);
      }
      await verifyConnection(run, remoteOS);
      this.lastOS = remoteOS;
      if (systemResult.cpuStat) this.linuxCpuStat = systemResult.cpuStat;
      const system: SystemInfo = systemResult;

      return {
        hostName: this.cfg.name,
        remoteOS,
        system,
        services: [...dockerServices, ...nativeSvcs],
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        hostName: this.cfg.name,
        remoteOS: "unknown",
        system: { hostname: this.cfg.host, os: "unknown" },
        services: [],
        error: msg,
      };
    }
  }

  streamLogs(
    service: Service,
    onData: (chunk: string) => void,
    onClose?: (code: number | null) => void
  ): Promise<() => void> {
    if (service.kind === "system-service") {
      const cmd = nativeLogCommand(service, this.lastOS);
      if (cmd) {
        return this.transport.stream(cmd, onData, onClose);
      }
      // Fallback: one-shot snapshot for OSes without streaming log support
      const snapCmd = nativeLogSnapshot(service, this.lastOS);
      if (snapCmd) {
        return this.transport.run(snapCmd).then((out) => {
          onData(out);
          onClose?.(0);
          return () => {};
        });
      }
      onData(`No logs available for discovered process "${service.name}". Check the application's own log files.`);
      onClose?.(0);
      return Promise.resolve(() => {});
    }
    return streamDockerLogs(
      (cmd, d, c) => this.transport.stream(cmd, d, c),
      service,
      onData,
      onClose
    );
  }
}
