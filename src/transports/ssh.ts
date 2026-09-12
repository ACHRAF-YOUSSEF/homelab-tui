import { NodeSSH } from "node-ssh";
import { homedir } from "node:os";
import { readFileSync } from "node:fs";

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
const KEEPALIVE_INTERVAL = 15_000;
const KEEPALIVE_COUNT_MAX = 3;
const COMMAND_TIMEOUT = 30_000;

export class SSHTransport {
  private ssh = new NodeSSH();
  private readonly cfg: SSHConfig;
  private readonly onDisconnect?: () => void;
  private connected = false;
  private disposing = false;

  constructor(cfg: SSHConfig, onDisconnect?: () => void) {
    this.cfg = cfg;
    this.onDisconnect = onDisconnect;
  }

  async reconnect(opts: ConnectOptions = {}): Promise<void> {
    this.disposing = true;
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
    const fire = () => {
      if (this.connected && !this.disposing) {
        this.connected = false;
        this.onDisconnect?.();
      }
    };
    conn.on("close", fire);
    conn.on("error", fire);
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
      this.connected = true;
      this.wireDisconnect();
      return;
    }

    // Key-based auth
    const agentSocket = process.env.SSH_AUTH_SOCK;
    if (agentSocket && !opts.passphrase) {
      try {
        await this.ssh.connect({ ...base, agent: agentSocket });
        this.connected = true;
        this.wireDisconnect();
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
      this.connected = true;
      this.wireDisconnect();
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

  async run(command: string): Promise<string> {
    if (!this.connected) throw new Error("SSH not connected");
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Command timed out after ${COMMAND_TIMEOUT / 1000}s`)), COMMAND_TIMEOUT)
    );
    const result = await Promise.race([
      this.ssh.execCommand(command, { execOptions: { pty: false } }),
      timeout,
    ]);
    if (result.stderr && !result.stdout) throw new Error(result.stderr.trim());
    return result.stdout.trim();
  }

  async dispose(): Promise<void> {
    this.disposing = true;
    this.connected = false;
    try { this.ssh.dispose(); } catch {}
  }
}
