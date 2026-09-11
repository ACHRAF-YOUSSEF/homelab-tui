import React, { act, useState } from "react";
import { expect, test } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { TextInput } from "./tui.js";

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
