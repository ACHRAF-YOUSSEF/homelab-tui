import { expect, test } from "bun:test";
import { sanitizeLogLine, splitLogChunk } from "./LogPanel.js";

test("log lines cannot alter terminal layout", () => {
  const line = "11 Sep 2026\t\u001b[32m* DB\u001b[0m saved\r\u0007";

  expect(sanitizeLogLine(line)).toBe("11 Sep 2026    * DB saved");
});

test("log lines survive arbitrary SSH chunk boundaries", () => {
  let remainder = "";
  const lines: string[] = [];

  for (const chunk of ["first li", "ne\nsecond \u001b[3", "2mline\u001b[0m\nthird"]) {
    const next = splitLogChunk(remainder, chunk);
    lines.push(...next.lines);
    remainder = next.remainder;
  }

  expect([...lines, remainder].map(sanitizeLogLine)).toEqual(["first line", "second line", "third"]);
});
