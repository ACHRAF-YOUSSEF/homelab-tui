import React, { useEffect, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";

const VIEW_HEIGHT = 15;

type Props = {
  lines: string[];
  loading: boolean;
  serviceName: string | null;
};

export function LogPanel({ lines, loading, serviceName }: Readonly<Props>) {
  // scrollOffset: 0 = follow bottom, N = N lines from bottom
  const [scrollOffset, setScrollOffset] = useState(0);
  const prevLenRef = useRef(lines.length);

  // Auto-scroll to bottom when new lines arrive, unless user has scrolled up
  useEffect(() => {
    if (scrollOffset === 0) return; // already following
    const added = lines.length - prevLenRef.current;
    if (added > 0) {
      setScrollOffset((off) => Math.max(0, off - added));
    }
    prevLenRef.current = lines.length;
  }, [lines.length, scrollOffset]);

  useEffect(() => {
    prevLenRef.current = lines.length;
  }, [lines.length]);

  useInput((_input, key) => {
    if (key.upArrow || key.pageUp) {
      const step = key.pageUp ? VIEW_HEIGHT : 1;
      setScrollOffset((off) => Math.min(off + step, Math.max(0, lines.length - VIEW_HEIGHT)));
    }
    if (key.downArrow || key.pageDown) {
      const step = key.pageDown ? VIEW_HEIGHT : 1;
      setScrollOffset((off) => Math.max(0, off - step));
    }
  });

  const totalLines = lines.length;
  const end = totalLines - scrollOffset;
  const start = Math.max(0, end - VIEW_HEIGHT);
  const visible = lines.slice(start, end);
  const following = scrollOffset === 0;
  const position = totalLines === 0 ? "empty" : `${start + 1}–${end} of ${totalLines}`;

  return (
    <Box
      borderStyle="single"
      borderColor="yellow"
      paddingX={1}
      flexDirection="column"
    >
      <Box>
        <Text bold color="yellow">Logs: {serviceName ?? "—"}</Text>
        <Text>{"  "}</Text>
        <Text dimColor>{loading ? "loading… " : ""}{position}</Text>
        <Text>{"  "}</Text>
        {following
          ? <Text color="green">▼ follow</Text>
          : <Text color="yellow">↑ paused  ↓/PgDn resume</Text>
        }
      </Box>

      {loading && lines.length === 0 ? (
        <Text dimColor>connecting…</Text>
      ) : visible.length === 0 ? (
        <Text dimColor>no output</Text>
      ) : (
        visible.map((line, i) => (
          <Text key={start + i} wrap="truncate">
            {line}
          </Text>
        ))
      )}
    </Box>
  );
}
