import { describe, expect, test } from "bun:test";
import { getServiceColumns, getTerminalLayout } from "./geometry.js";

describe("terminal geometry", () => {
  test("80x24 uses the compact single-pane layout", () => {
    expect(getTerminalLayout(80, 24, 1)).toEqual({
      compact: true,
      narrow: true,
      wide: false,
      footerCompact: true,
      paneWidth: 78,
      serviceRows: 6,
      logRows: 0,
    });
    expect(getServiceColumns(78)).toEqual({ name: 39, status: 12, image: 0, ports: 21 });
  });

  test("120x35 keeps metrics and details visible", () => {
    expect(getTerminalLayout(120, 35, 1)).toEqual({
      compact: false,
      narrow: false,
      wide: false,
      footerCompact: false,
      paneWidth: 118,
      serviceRows: 11,
      logRows: 0,
    });
    expect(getServiceColumns(118)).toEqual({ name: 31, status: 13, image: 39, ports: 29 });
  });

  test("wide terminals divide into stable panes", () => {
    expect(getTerminalLayout(200, 50, 2)).toEqual({
      compact: false,
      narrow: false,
      wide: true,
      footerCompact: false,
      paneWidth: 98,
      serviceRows: 12,
      logRows: 0,
    });
    expect(getServiceColumns(98)).toEqual({ name: 25, status: 11, image: 32, ports: 24 });
  });

  test("logs share the available height without overflowing", () => {
    expect(getTerminalLayout(80, 24, 1, true)).toMatchObject({ serviceRows: 2, logRows: 3 });
    expect(getTerminalLayout(140, 40, 1, true)).toMatchObject({ serviceRows: 8, logRows: 13 });
  });
});
