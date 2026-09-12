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
