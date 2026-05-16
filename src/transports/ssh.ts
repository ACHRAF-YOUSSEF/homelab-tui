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

export class PassphraseRequiredError extends Error {
  constructor() {
    super("Private key is encrypted — passphrase required");
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

export class SSHTransport {
  private readonly ssh = new NodeSSH();
  private readonly cfg: SSHConfig;
  private connected = false;

  constructor(cfg: SSHConfig) {
    this.cfg = cfg;
  }

  async connect(opts: ConnectOptions = {}): Promise<void> {
    const base = {
      host: this.cfg.host,
      port: this.cfg.port,
      username: this.cfg.username,
      readyTimeout: 10_000,
    };

    if (this.cfg.authMethod === "password") {
      if (!opts.password) throw new Error("Password required but not provided");
      await this.ssh.connect({ ...base, password: opts.password });
      this.connected = true;
      return;
    }

    // Key-based auth
    const agentSocket = process.env.SSH_AUTH_SOCK;
    if (agentSocket && !opts.passphrase) {
      try {
        await this.ssh.connect({ ...base, agent: agentSocket });
        this.connected = true;
        return;
      } catch {
        // Agent failed — fall through to key file
      }
    }

    const keyPath = (this.cfg.privateKeyPath ?? "~/.ssh/id_ed25519").replace(/^~/, homedir());
    let privateKey: string;
    try {
      privateKey = readFileSync(keyPath, "utf-8");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Cannot read private key at ${keyPath}: ${msg}`);
    }

    try {
      await this.ssh.connect({ ...base, privateKey, passphrase: opts.passphrase });
      this.connected = true;
    } catch (err: unknown) {
      if (isPassphraseError(err)) throw new PassphraseRequiredError();
      throw err;
    }
  }

  async run(command: string): Promise<string> {
    if (!this.connected) throw new Error("SSH not connected");
    const result = await this.ssh.execCommand(command, {
      execOptions: { pty: false },
    });
    if (result.stderr && !result.stdout) throw new Error(result.stderr.trim());
    return result.stdout.trim();
  }

  async dispose(): Promise<void> {
    if (this.connected) {
      this.ssh.dispose();
      this.connected = false;
    }
  }
}
