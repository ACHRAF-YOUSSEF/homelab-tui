import React, { act } from "react";
import { expect, test } from "bun:test";
import { Terminal } from "@xterm/headless";
import { testRender } from "@opentui/react/test-utils";
import { getTerminalScreen, moveItem, TerminalPanel } from "./TerminalPanel.js";

test("terminal screen parses control sequences and keeps a visible cursor", async () => {
  const terminal = new Terminal({ cols: 12, rows: 3, allowProposedApi: true });
  await new Promise<void>((resolve) => terminal.write("hello\r\n\x1b[31mworld\x1b[0m", resolve));

  const screen = getTerminalScreen(terminal);
  expect(screen[0].before + screen[0].cursor + screen[0].after).toStartWith("hello");
  expect(screen[1].before).toBe("world");
  expect(screen[1].cursor).toBe(" ");
  expect(moveItem(["one", "two", "three"], 1, 0)).toEqual(["two", "one", "three"]);
  terminal.dispose();
});

test("terminal panel stays inside compact and wide layouts", async () => {
  for (const width of [80, 200]) {
    const terminal = new Terminal({ cols: width - 4, rows: 4, allowProposedApi: true });
    await new Promise<void>((resolve) => terminal.write("prompt> output", resolve));
    const setup = await testRender(
      React.createElement(TerminalPanel, {
        sessions: [{ id: 1, title: "shell", status: "live", terminal }],
        activeIndex: 0,
        width,
      }),
      { width, height: 7 },
    );
    try {
      await act(async () => { await setup.renderOnce(); });
      const lines = setup.captureCharFrame().trimEnd().split("\n");
      expect(lines).toHaveLength(7);
      expect(lines.every((line) => [...line].length <= width)).toBe(true);
      expect(setup.captureCharFrame()).toContain("prompt> output");
    } finally {
      act(() => { setup.renderer.destroy(); });
      terminal.dispose();
    }
  }
});
