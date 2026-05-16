import { NodeSSH } from "node-ssh";
import { homedir } from "node:os";
import { readFileSync } from "node:fs";

export type SSHConfig = {
  host: string;
  port: number;
  username: string;
  privateKeyPath: string;
};

export class PassphraseRequiredError extends Error {
  constructor() {
    super("Private key is encrypted — passphrase required");
    this.name = "PassphraseRequiredError";
  }
}

function isPassphraseError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.toLowerCase().includes("passphrase") ||
    msg.toLowerCase().includes("encrypted key") ||
    msg.toLowerCase().includes("bad passphrase") ||
    msg.toLowerCase().includes("cannot parse privatekey")
  );
}

export class SSHTransport {
  private readonly ssh = new NodeSSH();
  private readonly cfg: SSHConfig;
  private connected = false;

  constructor(cfg: SSHConfig) {
    this.cfg = cfg;
  }

  async connect(passphrase?: string): Promise<void> {
    const agentSocket = process.env.SSH_AUTH_SOCK;
    const keyPath = this.cfg.privateKeyPath.replace(/^~/, homedir());

    // Try SSH agent first — avoids needing to decrypt the key ourselves
    if (agentSocket && !passphrase) {
      try {
        await this.ssh.connect({
          host: this.cfg.host,
          port: this.cfg.port,
          username: this.cfg.username,
          agent: agentSocket,
          readyTimeout: 10_000,
        });
        this.connected = true;
        return;
      } catch {
        // Agent failed — fall through to key file
      }
    }

    let privateKey: string;
    try {
      privateKey = readFileSync(keyPath, "utf-8");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Cannot read private key at ${keyPath}: ${msg}`);
    }

    try {
      await this.ssh.connect({
        host: this.cfg.host,
        port: this.cfg.port,
        username: this.cfg.username,
        privateKey,
        passphrase,
        readyTimeout: 10_000,
      });
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
