import { describe, expect, spyOn, test } from "bun:test";
import { EventEmitter } from "node:events";
import { createServer } from "node:net";
import { NodeSSH, type SSHExecCommandResponse } from "node-ssh";
import { Monitor } from "../core/monitor.js";
import { classifySSHError, SSHTransport } from "./ssh.js";

describe("classifySSHError", () => {
  const cases = [
    ["authentication", new Error("All configured authentication methods failed")],
    ["refused", Object.assign(new Error("All configured authentication methods failed"), { code: "ECONNREFUSED" })],
    ["timeout", Object.assign(new Error("connect failed"), { code: "ETIMEDOUT" })],
    ["host-not-found", Object.assign(new Error("getaddrinfo failed"), { code: "ENOTFOUND" })],
    ["unreachable", new Error("No route to host")],
    ["host-key", new Error("Host key verification failed")],
    ["key-file", new Error("Cannot read private key at /tmp/missing")],
    ["disconnected", new Error("SSH not connected")],
  ] as const;

  for (const [kind, error] of cases) {
    test(kind, () => expect(classifySSHError(error).kind).toBe(kind));
  }

  test("only transient network failures retry automatically", () => {
    expect(classifySSHError(new Error("Connection refused")).retryable).toBe(true);
    expect(classifySSHError(new Error("Authentication failed")).retryable).toBe(false);
    expect(classifySSHError(new Error("Host key verification failed")).retryable).toBe(false);
  });
});

test("stale events and statusless commands cannot hide a disconnect", async () => {
  const connections: EventEmitter[] = [];
  let finishCommand!: (result: SSHExecCommandResponse) => void;
  const connect = spyOn(NodeSSH.prototype, "connect").mockImplementation(async function (this: NodeSSH) {
    this.connection = new EventEmitter() as NodeSSH["connection"];
    connections.push(this.connection);
    return this;
  });
  const dispose = spyOn(NodeSSH.prototype, "dispose").mockImplementation(function (this: NodeSSH) {
    this.connection = null;
  });
  const execCommand = spyOn(NodeSSH.prototype, "execCommand").mockImplementation(() =>
    new Promise((resolve) => { finishCommand = resolve; })
  );

  try {
    let disconnects = 0;
    const transport = new SSHTransport({
      host: "example.test",
      port: 22,
      username: "tester",
      authMethod: "password",
    }, () => { disconnects++; });

    await transport.connect({ password: "secret" });
    const oldConnection = connections[0];
    await transport.reconnect({ password: "secret" });
    const currentConnection = connections[1];
    const command = transport.run("true");

    oldConnection.emit("close");
    expect(disconnects).toBe(0);

    finishCommand({ stdout: "", stderr: "", code: null, signal: null });

    await expect(command).rejects.toMatchObject({ kind: "disconnected" });
    expect(disconnects).toBe(1);

    currentConnection.emit("end");
    currentConnection.emit("close");
    expect(disconnects).toBe(1);

    await transport.reconnect({ password: "secret" });
    await expect(transport.run("slow", 1)).rejects.toMatchObject({ kind: "disconnected" });
    expect(disconnects).toBe(2);
  } finally {
    connect.mockRestore();
    dispose.mockRestore();
    execCommand.mockRestore();
  }
});

test("interactive shells forward output, input, and terminal resizes", async () => {
  const writes: string[] = [];
  const resizes: number[][] = [];
  let requestedSize: unknown;
  let destroyed = false;
  const channel = Object.assign(new EventEmitter(), {
    stderr: new EventEmitter(),
    write: (data: string) => { writes.push(data); },
    setWindow: (...size: number[]) => { resizes.push(size); },
    destroy: () => { destroyed = true; },
  });
  const connect = spyOn(NodeSSH.prototype, "connect").mockImplementation(async function (this: NodeSSH) {
    this.connection = new EventEmitter() as NodeSSH["connection"];
    return this;
  });
  const requestShell = spyOn(NodeSSH.prototype, "requestShell").mockImplementation(async (size) => {
    requestedSize = size;
    return channel as never;
  });
  const dispose = spyOn(NodeSSH.prototype, "dispose").mockImplementation(function (this: NodeSSH) {
    this.connection = null;
  });

  try {
    const output: Uint8Array[] = [];
    const transport = new SSHTransport({
      host: "example.test", port: 22, username: "tester", authMethod: "password",
    });
    await transport.connect({ password: "secret" });
    const shell = await transport.openShell({ columns: 100, rows: 30 }, (chunk) => output.push(chunk));

    channel.emit("data", Buffer.from("ready"));
    shell.input("pwd\r");
    shell.resize({ columns: 120, rows: 40 });
    shell.close();

    expect(requestedSize).toEqual({ term: "xterm-256color", cols: 100, rows: 30 });
    expect(Buffer.from(output[0]).toString()).toBe("ready");
    expect(writes).toEqual(["pwd\r"]);
    expect(resizes).toEqual([[40, 120, 0, 0]]);
    expect(destroyed).toBe(true);
    await transport.dispose();
  } finally {
    connect.mockRestore();
    requestShell.mockRestore();
    dispose.mockRestore();
  }
});

test("a refused SSH listener closes an established transport", async () => {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("TCP test server has no port");

  const connect = spyOn(NodeSSH.prototype, "connect").mockImplementation(async function (this: NodeSSH) {
    this.connection = new EventEmitter() as NodeSSH["connection"];
    return this;
  });
  const dispose = spyOn(NodeSSH.prototype, "dispose").mockImplementation(function (this: NodeSSH) {
    this.connection = null;
  });

  try {
    let disconnected!: () => void;
    const detected = new Promise<void>((resolve) => { disconnected = resolve; });
    const transport = new SSHTransport({
      host: "127.0.0.1",
      port: address.port,
      username: "tester",
      authMethod: "password",
    }, disconnected);

    await transport.connect({ password: "secret" });
    await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
    await Promise.race([
      detected,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("listener loss was not detected")), 5_000)),
    ]);
    expect(dispose).toHaveBeenCalled();
  } finally {
    if (server.listening) server.close();
    connect.mockRestore();
    dispose.mockRestore();
  }
});

test("an empty OS probe cannot become a successful empty snapshot", async () => {
  const run = spyOn(SSHTransport.prototype, "run").mockResolvedValue("");
  try {
    const monitor = new Monitor({
      name: "test",
      host: "example.test",
      port: 22,
      username: "tester",
      authMethod: "key",
      discovery: { docker: true, nativeServices: true, includeStoppedContainers: true },
    });

    const snapshot = await monitor.refresh();
    expect(snapshot.error).toContain("Connection lost");
    expect(snapshot.services).toEqual([]);
  } finally {
    run.mockRestore();
  }
});

test("a refresh is discarded when its final health check fails", async () => {
  let healthChecks = 0;
  const run = spyOn(SSHTransport.prototype, "run").mockImplementation(async (command) => {
    if (command === "uname -s") return "Linux";
    if (command.includes("__homelab_tui_alive__")) {
      healthChecks++;
      return healthChecks === 1 ? "__homelab_tui_alive__" : "";
    }
    if (command.includes("hostname")) return "test-host";
    return "";
  });
  try {
    const monitor = new Monitor({
      name: "test",
      host: "example.test",
      port: 22,
      username: "tester",
      authMethod: "key",
      discovery: { docker: false, nativeServices: false, includeStoppedContainers: true },
    });

    const snapshot = await monitor.refresh();
    expect(healthChecks).toBe(2);
    expect(snapshot.error).toContain("Connection lost");
  } finally {
    run.mockRestore();
  }
});
