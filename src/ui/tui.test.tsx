import React, { act, useState } from "react";
import { expect, test } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { Text, TextInput } from "./tui.js";
import { Footer } from "./Footer.js";

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
    for (const hint of ["filter", "sort", "add pane", "close pane", "swap pane", "hosts", "pane 2/2", "quit"]) {
      expect(frame).toContain(hint);
    }
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
