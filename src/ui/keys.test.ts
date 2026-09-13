import { expect, test } from "bun:test";
import { parseKeypress } from "@opentui/core";
import { encodeTerminalKey } from "./keys.js";

const parse = (sequence: string) => {
  const key = parseKeypress(sequence, { useKittyKeyboard: true });
  if (!key) throw new Error(`Could not parse ${JSON.stringify(sequence)}`);
  return key;
};

test("terminal keys use xterm bytes instead of outer Kitty sequences", () => {
  expect(encodeTerminalKey(parse("\u001b[A"), false)).toBe("\u001b[A");
  expect(encodeTerminalKey(parse("\u001b[A"), true)).toBe("\u001bOA");
  expect(encodeTerminalKey(parse("\u001b[99;5u"), false)).toBe("\u0003");
  expect(encodeTerminalKey(parse("\u001b[120;3u"), false)).toBe("\u001bx");
  expect(encodeTerminalKey(parse("\u001b[1;5C"), false)).toBe("\u001b[1;5C");
  expect(encodeTerminalKey(parse("\u001b[H"), true)).toBe("\u001bOH");
  expect(encodeTerminalKey(parse("\u001bOP"), false)).toBe("\u001bOP");
  expect(encodeTerminalKey(parse("\u001b[24~"), false)).toBe("\u001b[24~");
  expect(encodeTerminalKey(parse("hello"), false)).toBe("hello");
});
