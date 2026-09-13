type InkKey = {
  upArrow?: boolean;
  downArrow?: boolean;
  return?: boolean;
  escape?: boolean;
  tab?: boolean;
  shift?: boolean;
  pageUp?: boolean;
  pageDown?: boolean;
};

type TerminalKey = {
  name: string;
  sequence: string;
  ctrl: boolean;
  meta: boolean;
  option: boolean;
  shift: boolean;
};

const ESC = "\u001b";
const cursorKeys: Record<string, string> = {
  up: "A",
  down: "B",
  right: "C",
  left: "D",
};
const tildeKeys: Record<string, number> = {
  insert: 2,
  delete: 3,
  pageup: 5,
  pagedown: 6,
  f5: 15,
  f6: 17,
  f7: 18,
  f8: 19,
  f9: 20,
  f10: 21,
  f11: 23,
  f12: 24,
};

const terminalModifier = (key: TerminalKey) =>
  1 + (key.shift ? 1 : 0) + (key.meta || key.option ? 2 : 0) + (key.ctrl ? 4 : 0);

const controlCharacter = (name: string) => {
  const upper = name.toUpperCase();
  if (/^[A-Z]$/.test(upper)) return String.fromCharCode(upper.charCodeAt(0) - 64);
  const controls: Record<string, string> = {
    " ": "\u0000",
    "@": "\u0000",
    "[": ESC,
    "\\": "\u001c",
    "]": "\u001d",
    "^": "\u001e",
    _: "\u001f",
    "?": "\u007f",
  };
  return controls[name];
};

export function encodeTerminalKey(key: TerminalKey, applicationCursorKeysMode: boolean): string {
  const modifier = terminalModifier(key);
  const cursor = cursorKeys[key.name];
  if (cursor) {
    if (modifier > 1) return `${ESC}[1;${modifier}${cursor}`;
    return `${ESC}${applicationCursorKeysMode ? "O" : "["}${cursor}`;
  }

  if (key.name === "home" || key.name === "end") {
    const final = key.name === "home" ? "H" : "F";
    if (modifier > 1) return `${ESC}[1;${modifier}${final}`;
    return `${ESC}${applicationCursorKeysMode ? "O" : "["}${final}`;
  }

  const tilde = tildeKeys[key.name];
  if (tilde) return `${ESC}[${tilde}${modifier > 1 ? `;${modifier}` : ""}~`;

  const functionKey = /^f([1-4])$/.exec(key.name);
  if (functionKey) {
    const final = "PQRS"[Number(functionKey[1]) - 1];
    return modifier > 1 ? `${ESC}[1;${modifier}${final}` : `${ESC}O${final}`;
  }

  let data = key.sequence || key.name;
  if (key.name === "return" || key.name === "enter") data = "\r";
  else if (key.name === "tab") data = key.shift ? `${ESC}[Z` : "\t";
  else if (key.name === "backspace") data = "\u007f";
  else if (key.name === "escape") data = ESC;
  else if (key.ctrl) data = controlCharacter(key.name) ?? data;

  return (key.meta || key.option) && !data.startsWith(ESC) ? ESC + data : data;
}

export type KeyBinding = {
  display: string;
  label: string;
  matches: (input: string, key: InkKey) => boolean;
};

const character = (input: string, label: string): KeyBinding => ({
  display: input,
  label,
  matches: (value) => value === input,
});

const special = (
  display: string,
  label: string,
  matches: KeyBinding["matches"],
): KeyBinding => ({ display, label, matches });

const isShiftTab = (input: string, key: InkKey) =>
  input === "[Z" || input === "\u001b[Z" || Boolean(key.shift && key.tab);

export const monitorKeys = {
  up: special("↑", "select", (_input, key) => Boolean(key.upArrow)),
  down: special("↓", "select", (_input, key) => Boolean(key.downArrow)),
  pageUp: special("PgUp", "page up", (_input, key) => Boolean(key.pageUp)),
  pageDown: special("PgDn", "page down", (_input, key) => Boolean(key.pageDown)),
  restart: character("r", "restart"),
  retry: character("r", "reconnect"),
  credentials: character("c", "credentials"),
  stop: character("s", "stop"),
  kill: character("s", "kill"),
  start: character("t", "start"),
  logs: character("l", "logs"),
  terminal: character("v", "terminal"),
  search: character("/", "search"),
  filter: character("f", "filter"),
  sort: character("o", "sort"),
  addPane: character("a", "add tab"),
  closePane: character("x", "close tab"),
  nextPane: special("Tab", "next tab", (input, key) => Boolean(key.tab && !isShiftTab(input, key))),
  previousPane: special("Shift+Tab", "previous tab", isShiftTab),
  hosts: character("h", "hosts"),
  quit: character("q", "quit"),
  confirm: special("Enter", "confirm", (_input, key) => Boolean(key.return)),
  cancel: special("Esc", "cancel", (_input, key) => Boolean(key.escape)),
} as const;
