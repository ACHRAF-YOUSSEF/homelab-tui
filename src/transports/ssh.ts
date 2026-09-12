import { NodeSSH } from "node-ssh";
import { homedir } from "node:os";
import { readFileSync } from "node:fs";
import { createConnection } from "node:net";

export type SSHConfig = {
  host: string;
  port: number;
  username: string;
  authMethod: "key" | "password";
  privateKeyPath?: string;
};

export type ConnectOptions = {
  passphrase?: string;
  password?: string;
};

export type SSHErrorKind =
  | "authentication"
  | "refused"
  | "timeout"
  | "host-not-found"
  | "unreachable"
  | "host-key"
  | "key-file"
  | "disconnected"
  | "unknown";

export class SSHConnectionError extends Error {
  constructor(
    readonly kind: SSHErrorKind,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "SSHConnectionError";
  }
}

export function classifySSHError(err: unknown): SSHConnectionError {
  if (err instanceof SSHConnectionError) return err;

  const message = err instanceof Error ? err.message : String(err);
  const code = typeof err === "object" && err !== null && "code" in err
    ? String((err as { code?: unknown }).code ?? "").toUpperCase()
    : "";

  if (code === "ECONNREFUSED") return new SSHConnectionError("refused", message, true);
  if (code === "ETIMEDOUT") return new SSHConnectionError("timeout", message, true);
  if (code === "ENOTFOUND") return new SSHConnectionError("host-not-found", message, false);
  if (code === "EHOSTUNREACH" || code === "ENETUNREACH") return new SSHConnectionError("unreachable", message, true);
  if (code === "ECONNRESET" || code === "EPIPE") return new SSHConnectionError("disconnected", message, true);

  if (/host key|fingerprint|remote host identification has changed/i.test(message)) {
    return new SSHConnectionError("host-key", message, false);
  }
  if (/cannot read private key|private key.*(?:not found|no such file|permission denied)/i.test(message)) {
    return new SSHConnectionError("key-file", message, false);
  }
  if (/all configured authentication methods failed|authentication failed|auth.*failed|permission denied|no more authentication methods available/i.test(message)) {
    return new SSHConnectionError("authentication", message, false);
  }
  if (code === "ECONNREFUSED" || /connection refused|connect econnrefused/i.test(message)) {
    return new SSHConnectionError("refused", message, true);
  }
  if (code === "ETIMEDOUT" || /timed?\s*out|timeout|handshake timeout/i.test(message)) {
    return new SSHConnectionError("timeout", message, true);
  }
  if (code === "ENOTFOUND" || /getaddrinfo enotfound|name or service not known|host not found/i.test(message)) {
    return new SSHConnectionError("host-not-found", message, false);
  }
  if (code === "EHOSTUNREACH" || code === "ENETUNREACH" || /no route to host|network is unreachable|host is unreachable/i.test(message)) {
    return new SSHConnectionError("unreachable", message, true);
  }
  if (code === "ECONNRESET" || code === "EPIPE" || /not connected|ssh not|econnreset|socket.*closed|connection (?:lost|closed)/i.test(message)) {
    return new SSHConnectionError("disconnected", message, true);
  }
  return new SSHConnectionError("unknown", message, false);
}

export class PassphraseRequiredError extends Error {
  constructor(rejected = false) {
    super(rejected ? "Private key passphrase was rejected" : "Private key is encrypted — passphrase required");
    this.name = "PassphraseRequiredError";
  }
}

function isPassphraseError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  return (
    lower.includes("passphrase") ||
    lower.includes("encrypted key") ||
    lower.includes("bad passphrase") ||
    lower.includes("cannot parse privatekey")
  );
}

const READY_TIMEOUT = 15_000;
const KEEPALIVE_INTERVAL = 5_000;
const KEEPALIVE_COUNT_MAX = 2;
const COMMAND_TIMEOUT = 30_000;
const LISTENER_PROBE_INTERVAL = 3_000;
const LISTENER_PROBE_TIMEOUT = 2_000;

function probeListener(host: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host, port });
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error);
      else resolve();
    };

    socket.once("connect", () => finish());
    socket.once("error", finish);
    socket.setTimeout(LISTENER_PROBE_TIMEOUT, () => {
      finish(Object.assign(new Error("SSH listener probe timed out"), { code: "ETIMEDOUT" }));
    });
  });
}

export class SSHTransport {
  private ssh = new NodeSSH();
  private readonly cfg: SSHConfig;
  private readonly onDisconnect?: () => void;
  private connected = false;
  private disposing = false;
  private connectionGeneration = 0;
  private listenerProbeTimer?: ReturnType<typeof setInterval>;
  private listenerProbeInFlight = false;
  private listenerProbeFailures = 0;

  constructor(cfg: SSHConfig, onDisconnect?: () => void) {
    this.cfg = cfg;
    this.onDisconnect = onDisconnect;
  }

  private markDisconnected(generation: number): void {
    if (generation !== this.connectionGeneration || !this.connected || this.disposing) return;
    this.connected = false;
    this.stopListenerProbe();
    try { this.ssh.dispose(); } catch {}
    this.onDisconnect?.();
  }

  private stopListenerProbe(): void {
    if (this.listenerProbeTimer) clearInterval(this.listenerProbeTimer);
    this.listenerProbeTimer = undefined;
    this.listenerProbeFailures = 0;
  }

  private startListenerProbe(): void {
    this.stopListenerProbe();
    const generation = this.connectionGeneration;
    this.listenerProbeTimer = setInterval(async () => {
      if (this.listenerProbeInFlight || generation !== this.connectionGeneration || !this.connected) return;
      this.listenerProbeInFlight = true;
      try {
        await probeListener(this.cfg.host, this.cfg.port);
        if (generation === this.connectionGeneration) this.listenerProbeFailures = 0;
      } catch (err: unknown) {
        if (generation !== this.connectionGeneration || !this.connected) return;
        this.listenerProbeFailures++;
        if (classifySSHError(err).kind === "refused" || this.listenerProbeFailures >= 2) {
          this.markDisconnected(generation);
        }
      } finally {
        this.listenerProbeInFlight = false;
      }
    }, LISTENER_PROBE_INTERVAL);
    this.listenerProbeTimer.unref?.();
  }

  private markConnected(): void {
    this.connected = true;
    this.wireDisconnect();
    this.startListenerProbe();
  }

  async reconnect(opts: ConnectOptions = {}): Promise<void> {
    this.disposing = true;
    this.connectionGeneration++;
    this.stopListenerProbe();
    try { this.ssh.dispose(); } catch {}
    this.ssh = new NodeSSH();
    this.connected = false;
    this.disposing = false;
    await this.connect(opts);
  }

  private wireDisconnect(): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conn = this.ssh.connection as any;
    if (!conn) return;
    const generation = this.connectionGeneration;
    const fire = () => this.markDisconnected(generation);
    conn.once("error", fire);
    conn.once("end", fire);
    conn.once("close", fire);
  }

  async connect(opts: ConnectOptions = {}): Promise<void> {
    this.disposing = false;
    const base = {
      host: this.cfg.host,
      port: this.cfg.port,
      username: this.cfg.username,
      readyTimeout: READY_TIMEOUT,
      keepaliveInterval: KEEPALIVE_INTERVAL,
      keepaliveCountMax: KEEPALIVE_COUNT_MAX,
    };

    if (this.cfg.authMethod === "password") {
      if (!opts.password) throw new SSHConnectionError("authentication", "Password required but not provided", false);
      try {
        await this.ssh.connect({ ...base, password: opts.password });
      } catch (err: unknown) {
        throw classifySSHError(err);
      }
      this.markConnected();
      return;
    }

    // Key-based auth
    const agentSocket = process.env.SSH_AUTH_SOCK;
    if (agentSocket && !opts.passphrase) {
      try {
        await this.ssh.connect({ ...base, agent: agentSocket });
        this.markConnected();
        return;
      } catch (err: unknown) {
        const failure = classifySSHError(err);
        if (!["authentication", "unknown"].includes(failure.kind)) throw failure;
        // Agent auth failed — fall through to the configured key file.
      }
    }

    const keyPath = (this.cfg.privateKeyPath ?? "~/.ssh/id_ed25519").replace(/^~/, homedir());
    let privateKey: string;
    try {
      privateKey = readFileSync(keyPath, "utf-8");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new SSHConnectionError("key-file", `Cannot read private key at ${keyPath}: ${message}`, false);
    }

    try {
      await this.ssh.connect({ ...base, privateKey, passphrase: opts.passphrase });
      this.markConnected();
    } catch (err: unknown) {
      if (isPassphraseError(err)) throw new PassphraseRequiredError(Boolean(opts.passphrase));
      throw classifySSHError(err);
    }
  }

  // Starts a persistent SSH channel (e.g. for `docker logs -f`).
  // Returns a cancel function that destroys the channel.
  stream(
    command: string,
    onData: (chunk: string) => void,
    onClose?: (code: number | null) => void
  ): Promise<() => void> {
    if (!this.connected) return Promise.reject(new Error("SSH not connected"));
    return new Promise((resolve, reject) => {
      // Use bracket notation — this calls ssh2 Client.exec(), not child_process.exec().
      // The command is fully controlled by our code, not user input.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conn = this.ssh.connection as any;
      conn["exec"](command, (err: Error, channel: any) => {
        if (err) { reject(err); return; }
        channel.on("data", (d: Buffer) => onData(d.toString()));
        channel.stderr.on("data", (d: Buffer) => onData(d.toString()));
        channel.on("close", (code: number | null) => onClose?.(code));
        resolve(() => channel.destroy());
      });
    });
  }

  async run(command: string, timeoutMs = COMMAND_TIMEOUT): Promise<string> {
    if (!this.connected) throw new SSHConnectionError("disconnected", "SSH not connected", true);
    const generation = this.connectionGeneration;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => {
          this.markDisconnected(generation);
          reject(new SSHConnectionError("disconnected", `SSH command timed out after ${timeoutMs / 1000}s`, true));
        },
        timeoutMs,
      );
    });
    try {
      const result = await Promise.race([
        this.ssh.execCommand(command, { execOptions: { pty: false } }),
        timeout,
      ]);
      if (generation !== this.connectionGeneration || !this.connected) {
        throw new SSHConnectionError("disconnected", "Connection lost", true);
      }
      if (result.code === null && result.signal === null) {
        this.markDisconnected(generation);
        throw new SSHConnectionError("disconnected", "SSH command ended without an exit status", true);
      }
      if (result.stderr && !result.stdout) throw new Error(result.stderr.trim());
      return result.stdout.trim();
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  async dispose(): Promise<void> {
    this.disposing = true;
    this.connectionGeneration++;
    this.connected = false;
    this.stopListenerProbe();
    try { this.ssh.dispose(); } catch {}
  }
}
