import React, { act, useState } from "react";
import { expect, test } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { Text, TextInput } from "./tui.js";
import { Footer } from "./Footer.js";
import { Header } from "./Header.js";
import { ServiceDetails } from "./ServiceDetails.js";
import { SystemPanel } from "./SystemPanel.js";
import { getPickedHosts } from "./MultiMonitor.js";
import type { HostConfig } from "../core/types.js";

const host = (name: string, address: string): HostConfig => ({
  name,
  host: address,
  port: 22,
  username: "root",
  authMethod: "key",
  privateKeyPath: "~/.ssh/id_ed25519",
  discovery: { docker: true, nativeServices: false, includeStoppedContainers: true },
});

test("add-tab selection resolves every checked host and falls back to the focused host", () => {
  const hosts = [host("one", "10.0.0.1"), host("two", "10.0.0.2"), host("three", "10.0.0.3")];
  expect(getPickedHosts(hosts, new Set(["10.0.0.1:22", "10.0.0.3:22"]), 1)).toEqual([hosts[0], hosts[2]]);
  expect(getPickedHosts(hosts, new Set(), 1)).toEqual([hosts[1]]);
});

test("selected text remains readable without a solid background", async () => {
  const setup = await testRender(<Text color="#ffffff" inverse>selected</Text>, { width: 20, height: 1 });
  try {
    await act(async () => { await setup.renderOnce(); });

    const selected = setup.captureSpans().lines.flatMap((line) => line.spans).find((span) => span.text === "selected");
    expect(selected?.fg.toInts().slice(0, 3)).toEqual([255, 255, 255]);
    expect(selected?.bg.toInts()[3]).toBe(0);
  } finally {
    act(() => { setup.renderer.destroy(); });
  }
});

test("masked input never renders the submitted credential", async () => {
  let submitted = "";

  function Harness() {
    const [value, setValue] = useState("");
    return <TextInput value={value} onChange={setValue} onSubmit={(next) => { submitted = next; }} mask="*" focus />;
  }

  const setup = await testRender(<Harness />, { width: 20, height: 3 });
  try {
    await act(async () => {
      await setup.mockInput.typeText("secret");
      setup.mockInput.pressEnter();
    });
    await act(async () => { await setup.renderOnce(); });

    const frame = setup.captureCharFrame();
    expect(frame).toContain("******");
    expect(frame).not.toContain("secret");
    expect(submitted).toBe("secret");
  } finally {
    act(() => { setup.renderer.destroy(); });
  }
});

test("wrapped footer keeps every keyboard hint visible", async () => {
  const setup = await testRender(
    <Footer actionMessage={null} error={null} paneCount={2} focusedPane={1} canAddPane canRemovePane />,
    { width: 80, height: 4 },
  );
  try {
    await act(async () => { await setup.renderOnce(); });
    const frame = setup.captureCharFrame();
    const lines = frame.trimEnd().split("\n");
    expect(lines).toHaveLength(4);
    expect(lines.at(-1)).toStartWith("└");
    for (const hint of ["terminal", "filter", "sort", "add tab", "close tab", "hosts", "tab 2/2", "quit"]) {
      expect(frame).toContain(hint);
    }
    expect(frame).not.toContain("move tab");
  } finally {
    act(() => { setup.renderer.destroy(); });
  }
});

test("terminal footer exposes the prefix without stealing shell keys", async () => {
  const setup = await testRender(
    <Footer
      actionMessage={null}
      error={null}
      terminal={{ active: 1, count: 3, hostIndex: 0, hostCount: 2, prompt: "prefix" }}
    />,
    { width: 80, height: 3 },
  );
  try {
    await act(async () => { await setup.renderOnce(); });
    const frame = setup.captureCharFrame();
    for (const hint of ["details", "new", "close", "select", "reorder", "host"]) expect(frame).toContain(hint);
  } finally {
    act(() => { setup.renderer.destroy(); });
  }
});

test("device metadata uses stable columns without a leading empty slot", async () => {
  const setup = await testRender(
    <Header
      snapshot={{
        hostName: "laptop",
        remoteOS: "linux",
        system: { hostname: "laptop-2", os: "linux" },
        services: [],
      }}
      connecting={false}
      lastUpdated={new Date("2026-09-12T15:09:19")}
      reconnectCountdown={null}
    />,
    { width: 120, height: 3 },
  );
  try {
    await act(async () => { await setup.renderOnce(); });
    const line = setup.captureCharFrame().split("\n")[1];
    const positions = ["host laptop", "os linux", "device laptop-2", "updated"].map((text) => line.indexOf(text));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(positions[0]).toBe(2);
  } finally {
    act(() => { setup.renderer.destroy(); });
  }
});

test("compact device metadata keeps the remote hostname visible", async () => {
  const setup = await testRender(
    <Header
      snapshot={{
        hostName: "friendly-alias",
        remoteOS: "linux",
        system: { hostname: "actual-device", os: "linux" },
        services: [],
      }}
      connecting={false}
      lastUpdated={new Date("2026-09-12T15:09:19")}
      reconnectCountdown={null}
      compact
    />,
    { width: 80, height: 3 },
  );
  try {
    await act(async () => { await setup.renderOnce(); });
    const frame = setup.captureCharFrame();
    expect(frame).toContain("device actual-device");
    expect(frame).not.toContain("friendly-alias");
    expect(frame.split("\n")[1]).toStartWith("│ device actual-device");
  } finally {
    act(() => { setup.renderer.destroy(); });
  }
});

test("compact metrics keep long mount names inside one row", async () => {
  const setup = await testRender(
    <SystemPanel
      compact
      containerWidth={80}
      system={{
        hostname: "host",
        os: "linux",
        cpuUsagePercent: 12,
        ram: { usedBytes: 8_000_000_000, totalBytes: 32_000_000_000 },
        disks: [
          { name: "/", freeBytes: 200_000_000_000, totalBytes: 700_000_000_000 },
          { name: "/tmp/.mount_AnExtremelyLongApplicationMountPoint", freeBytes: 1_000_000, totalBytes: 142_000_000 },
        ],
      }}
    />,
    { width: 80, height: 3 },
  );
  try {
    await act(async () => { await setup.renderOnce(); });
    const lines = setup.captureCharFrame().trimEnd().split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("CPU 12%");
    expect(lines[1]).toContain("RAM 7.5G/29.8G");
    expect(lines[1]).toContain("+1 disk");
    expect(lines.at(-1)).toStartWith("└");
  } finally {
    act(() => { setup.renderer.destroy(); });
  }
});

test("details truncate long process values without breaking the border", async () => {
  const setup = await testRender(
    <ServiceDetails
      containerWidth={80}
      paneLabel="[12] a-host-name-that-is-far-too-long-for-this-panel"
      service={{
        id: "proc:12345",
        name: "a-process-name-that-is-far-too-long-for-this-panel",
        kind: "system-service",
        status: "running",
        ports: "0.0.0.0:3000->3000/tcp, :::8853->8853/udp",
      }}
    />,
    { width: 80, height: 7 },
  );
  try {
    await act(async () => { await setup.renderOnce(); });
    const lines = setup.captureCharFrame().trimEnd().split("\n");
    expect(lines).toHaveLength(7);
    expect(lines.at(-1)).toStartWith("└");
    expect(lines.every((line) => [...line].length <= 80)).toBe(true);
  } finally {
    act(() => { setup.renderer.destroy(); });
  }
});

test("credential failures replace service actions with recovery hints", async () => {
  const setup = await testRender(
    <Footer actionMessage={null} error={null} connectionStatus="needs-credential" canRetry={false} />,
    { width: 80, height: 3 },
  );
  try {
    await act(async () => { await setup.renderOnce(); });
    const frame = setup.captureCharFrame();
    expect(frame).toContain("c credentials");
    expect(frame).toContain("h hosts");
    expect(frame).not.toContain("restart");
  } finally {
    act(() => { setup.renderer.destroy(); });
  }
});

test("disconnected tabs offer reconnect or close", async () => {
  const setup = await testRender(
    <Footer
      actionMessage={null}
      error={null}
      connectionStatus="disconnected"
      canRetry
      canRemovePane
    />,
    { width: 80, height: 3 },
  );
  try {
    await act(async () => { await setup.renderOnce(); });
    const frame = setup.captureCharFrame();
    expect(frame).toContain("r reconnect");
    expect(frame).toContain("x close tab");
    expect(frame).not.toContain("restart");
  } finally {
    act(() => { setup.renderer.destroy(); });
  }
});
