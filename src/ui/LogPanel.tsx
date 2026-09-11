import React, { useEffect, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import { palette } from "./palette.js";
import { monitorKeys } from "./keys.js";

const VIEW_HEIGHT = 15;

type Props = {
  lines: string[];
  loading: boolean;
  serviceName: string | null;
  visible: boolean;
};

export function LogPanel({ lines, loading, serviceName, visible }: Readonly<Props>) {
  const [scrollOffset, setScrollOffset] = useState(0);
  const prevLenRef = useRef(lines.length);

  // Reset scroll when panel opens for a new service
  useEffect(() => {
    if (visible) setScrollOffset(0);
  }, [visible]);

  // Auto-scroll when new lines arrive and user is following bottom
  useEffect(() => {
    if (scrollOffset === 0) { prevLenRef.current = lines.length; return; }
    const added = lines.length - prevLenRef.current;
    if (added > 0) setScrollOffset((off) => Math.max(0, off - added));
    prevLenRef.current = lines.length;
  }, [lines.length, scrollOffset]);

  useInput((input, key) => {
    if (!visible) return;
    if (monitorKeys.up.matches(input, key) || monitorKeys.pageUp.matches(input, key)) {
      const step = monitorKeys.pageUp.matches(input, key) ? VIEW_HEIGHT : 1;
      setScrollOffset((off) => Math.min(off + step, Math.max(0, lines.length - VIEW_HEIGHT)));
    }
    if (monitorKeys.down.matches(input, key) || monitorKeys.pageDown.matches(input, key)) {
      const step = monitorKeys.pageDown.matches(input, key) ? VIEW_HEIGHT : 1;
      setScrollOffset((off) => Math.max(0, off - step));
    }
  });

  // Always stay mounted — returning null here avoids Ink cursor desyncing
  // that occurs when a tall component is removed from the tree.
  if (!visible) return null;

  const totalLines = lines.length;
  const end = totalLines - scrollOffset;
  const start = Math.max(0, end - VIEW_HEIGHT);
  const visibleLines = lines.slice(start, end);
  const following = scrollOffset === 0;
  const position = totalLines === 0 ? "empty" : `${start + 1}–${end} of ${totalLines}`;

  return (
    <Box borderStyle="single" borderColor={palette.logs} paddingX={1} width="100%" flexDirection="column">
      <Box>
        <Text bold color={palette.logs}>Logs: {serviceName ?? "—"}</Text>
        <Text>{"  "}</Text>
        <Text dimColor>{loading ? "loading… " : ""}{position}</Text>
        <Text>{"  "}</Text>
        {following
          ? <Text color={palette.healthy}>▼ follow</Text>
          : <Text color={palette.warning}>{monitorKeys.up.display} paused  {monitorKeys.down.display}/{monitorKeys.pageDown.display} resume</Text>
        }
      </Box>
      {loading && totalLines === 0 ? (
        <Text dimColor>connecting…</Text>
      ) : visibleLines.length === 0 ? (
        <Text dimColor>no output</Text>
      ) : (
        visibleLines.map((line, i) => (
          <Text key={start + i} wrap="truncate">{line}</Text>
        ))
      )}
    </Box>
  );
}
