import { expect, test } from "bun:test";
import { sanitizeLogLine } from "./LogPanel.js";

test("log lines cannot alter terminal layout", () => {
  const line = "11 Sep 2026\t\u001b[32m* DB\u001b[0m saved\r\u0007";

  expect(sanitizeLogLine(line)).toBe("11 Sep 2026    * DB saved");
});
