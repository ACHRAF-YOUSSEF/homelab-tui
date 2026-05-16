import { SSHTransport,  } from "../transports/ssh.js";
import type { ConnectOptions } from "../transports/ssh.js";
import { detectRemoteOS } from "./os-detect.js";
import { getDockerServices, streamDockerLogs } from "../adapters/docker.js";
import type { HostConfig, MonitorSnapshot, SystemInfo, RemoteOS } from "./types.js";



async function getSystemInfo(
  run: (cmd: string) => Promise<string>,
  os: RemoteOS
): Promise<SystemInfo> {
  if (os === "linux") {
    const { getSystemInfo } = await import("../adapters/linux-system.js");
    return getSystemInfo(run);
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

export class Monitor {
  private readonly transport: SSHTransport;
  private readonly cfg: HostConfig;

  constructor(cfg: HostConfig) {
    this.cfg = cfg;
    this.transport = new SSHTransport({
      host: cfg.host,
      port: cfg.port,
      username: cfg.username,
      authMethod: cfg.authMethod,
      privateKeyPath: cfg.privateKeyPath,
    });
  }

  async connect(opts: ConnectOptions = {}): Promise<void> {
    await this.transport.connect(opts);
  }

  run(cmd: string): Promise<string> {
    return this.transport.run(cmd);
  }

  streamLogs(
    service: import("./types.js").Service,
    onData: (chunk: string) => void,
    onClose?: (code: number | null) => void
  ): Promise<() => void> {
    return streamDockerLogs(
      (cmd, d, c) => this.transport.stream(cmd, d, c),
      service,
      onData,
      onClose
    );
  }

  async dispose(): Promise<void> {
    await this.transport.dispose();
  }

  async refresh(): Promise<MonitorSnapshot> {
    const run = (cmd: string) => this.transport.run(cmd);
    try {
      const remoteOS = await detectRemoteOS(run);
      const [system, services] = await Promise.all([
        getSystemInfo(run, remoteOS),
        this.cfg.discovery.docker ? getDockerServices(run) : Promise.resolve([]),
      ]);
      return { hostName: this.cfg.name, remoteOS, system, services };
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
}

export {PassphraseRequiredError} from "../transports/ssh.js";