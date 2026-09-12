import { expect, test } from "bun:test";
import { getSystemInfo } from "./linux-system.js";

test("reads the Linux hostname from procfs when hostname is unavailable", async () => {
  const system = await getSystemInfo(async (command) => {
    if (command.startsWith("cat /proc/sys/kernel/hostname")) return "laptop-2";
    throw new Error("command unavailable");
  });

  expect(system.hostname).toBe("laptop-2");
});
