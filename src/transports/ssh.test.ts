import { describe, expect, test } from "bun:test";
import { classifySSHError } from "./ssh.js";

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
