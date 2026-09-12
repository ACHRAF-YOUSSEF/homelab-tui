import React from "react";
import type { Terminal } from "@xterm/headless";
import { Box, Text } from "./tui.js";
import { palette } from "./palette.js";

export type TerminalSessionView = {
  id: number;
  title: string;
  status: "opening" | "live" | "exited" | "error";
  terminal: Terminal;
};

export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return [...items];
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function getTerminalScreen(terminal: Terminal) {
  const buffer = terminal.buffer.active;
  const cursorRow = buffer.baseY + buffer.cursorY - buffer.viewportY;
  const cursorColumn = Math.min(buffer.cursorX, terminal.cols - 1);

  return Array.from({ length: terminal.rows }, (_, row) => {
    const line = buffer.getLine(buffer.viewportY + row);
    let before = "";
    let cursor = " ";
    let after = "";
    for (let column = 0; column < terminal.cols; column++) {
      const cell = line?.getCell(column);
      if (cell?.getWidth() === 0) continue;
      const value = cell?.getChars() || " ";
      if (row === cursorRow && column === cursorColumn) cursor = value;
      else if (row < cursorRow || (row === cursorRow && column < cursorColumn)) before += value;
      else after += value;
    }
    return { before, cursor: row === cursorRow ? cursor : "", after };
  });
}

type Props = {
  sessions: readonly TerminalSessionView[];
  activeIndex: number;
  width: number;
};

export function TerminalPanel({ sessions, activeIndex, width }: Readonly<Props>) {
  const active = sessions[activeIndex];
  const visibleCount = Math.max(1, Math.floor((width - 4) / 18));
  const start = Math.min(
    Math.max(0, activeIndex - Math.floor(visibleCount / 2)),
    Math.max(0, sessions.length - visibleCount),
  );
  const visible = sessions.slice(start, start + visibleCount);

  return (
    <Box borderStyle="single" borderColor={palette.focus} paddingX={1} width="100%" flexDirection="column" flexGrow={1}>
      <Box gap={1} height={1} overflow="hidden">
        {start > 0 && <Text dimColor>…</Text>}
        {visible.map((session, offset) => {
          const index = start + offset;
          const selected = index === activeIndex;
          const marker = session.status === "live" ? "●" : session.status === "opening" ? "○" : "×";
          const color = session.status === "error" ? palette.danger : session.status === "live" ? palette.healthy : palette.warning;
          return (
            <Box key={session.id} gap={1} maxWidth={18}>
              <Text color={selected ? palette.focus : palette.inactive} bold={selected} wrap="truncate">
                {selected ? ">" : " "} [{index + 1}] {session.title}
              </Text>
              <Text color={color}>{marker}</Text>
            </Box>
          );
        })}
        {start + visible.length < sessions.length && <Text dimColor>…</Text>}
      </Box>

      {!active ? (
        <Box alignItems="center" justifyContent="center" flexGrow={1}>
          <Text dimColor>No terminal on this host. Press Ctrl+B, then c to open one.</Text>
        </Box>
      ) : (
        <Box flexDirection="column" flexGrow={1} overflow="hidden">
          {getTerminalScreen(active.terminal).map((line, row) => (
            <Text key={row} wrap="truncate">
              {line.before}
              {line.cursor && <Text color="black" backgroundColor={palette.focus}>{line.cursor}</Text>}
              {line.after}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}
