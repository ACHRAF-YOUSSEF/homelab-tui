import { describe, expect, test } from "bun:test";
import { getFooterRows, getServiceColumns, getTerminalLayout, getVisibleTabIndexes } from "./geometry.js";

describe("terminal geometry", () => {
  test("80x24 uses the compact single-pane layout", () => {
    expect(getTerminalLayout(80, 24, 1)).toEqual({
      compact: true,
      narrow: true,
      wide: false,
      paneWidth: 78,
      serviceRows: 5,
      logRows: 0,
    });
    expect(getServiceColumns(78)).toEqual({ name: 39, status: 12, image: 0, ports: 21 });
  });

  test("120x35 keeps metrics and details visible", () => {
    expect(getTerminalLayout(120, 35, 1)).toEqual({
      compact: false,
      narrow: false,
      wide: false,
      paneWidth: 118,
      serviceRows: 11,
      logRows: 0,
    });
    expect(getServiceColumns(118)).toEqual({ name: 31, status: 13, image: 39, ports: 29 });
  });

  test("host tabs keep the active pane at full width", () => {
    expect(getTerminalLayout(200, 50, 2)).toEqual({
      compact: false,
      narrow: false,
      wide: true,
      paneWidth: 198,
      serviceRows: 12,
      logRows: 0,
    });
    expect(getServiceColumns(198)).toEqual({ name: 53, status: 23, image: 67, ports: 49 });
  });

  test("tab window always includes the focused host", () => {
    expect(getVisibleTabIndexes(80, 6, 0)).toEqual([0, 1]);
    expect(getVisibleTabIndexes(80, 6, 3)).toEqual([2, 3]);
    expect(getVisibleTabIndexes(80, 6, 5)).toEqual([4, 5]);
    expect(getVisibleTabIndexes(80, 12, 10)).toEqual([9, 10]);
    expect(getVisibleTabIndexes(80, 12, 11)).toEqual([10, 11]);
    expect(getVisibleTabIndexes(200, 6, 5)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  test("logs share the available height without overflowing", () => {
    expect(getFooterRows(80, 1)).toBe(4);
    expect(getFooterRows(80, 2)).toBe(4);
    expect(getFooterRows(140, 1)).toBe(3);
    expect(getFooterRows(140, 2)).toBe(4);
    expect(getTerminalLayout(80, 24, 1, true)).toMatchObject({ serviceRows: 1, logRows: 3 });
    expect(getTerminalLayout(140, 40, 1, true)).toMatchObject({ serviceRows: 8, logRows: 13 });
  });
});
