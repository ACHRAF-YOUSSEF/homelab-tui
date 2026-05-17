import { SSHTransport } from "../transports/ssh.js";
import type { ConnectOptions } from "../transports/ssh.js";
import { detectRemoteOS } from "./os-detect.js";
import { getDockerServices, streamDockerLogs } from "../adapters/docker.js";
import { nativeLogCommand, nativeLogSnapshot } from "../adapters/native-actions.js";
import type { HostConfig, MonitorSnapshot, SystemInfo, RemoteOS, Service } from "./types.js";

export { PassphraseRequiredError } from "../transports/ssh.js";

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

  constructor(cfg: HostConfig, onDisconnect?: () => void) {
    this.cfg = cfg;
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

  run(cmd: string): Promise<string> {
    return this.transport.run(cmd);
  }

  async dispose(): Promise<void> {
    await this.transport.dispose();
  }

  async refresh(): Promise<MonitorSnapshot> {
    const run = (cmd: string) => this.transport.run(cmd);
    try {
      const remoteOS = await detectRemoteOS(run);
      this.lastOS = remoteOS;

      const [systemResult, dockerServices, nativeSvcs] = await Promise.all([
        getSystemInfo(run, remoteOS, this.linuxCpuStat),
        this.cfg.discovery.docker ? getDockerServices(run) : Promise.resolve([]),
        this.cfg.discovery.nativeServices ? getNativeServices(run, remoteOS) : Promise.resolve([]),
      ]);
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
