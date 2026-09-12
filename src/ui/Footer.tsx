import React from "react";
import { Box, Text } from "./tui.js";
import type { ServiceKind } from "../core/types.js";
import type { PaneConnectionState } from "./MonitorPane.js";
import { monitorKeys, type KeyBinding } from "./keys.js";
import { palette } from "./palette.js";

type Props = {
  actionMessage: string | null;
  error: string | null;
  selectedKind?: ServiceKind;
  paneCount?: number;
  focusedPane?: number;
  canAddPane?: boolean;
  canRemovePane?: boolean;
  connectionStatus?: PaneConnectionState["status"];
  canRetry?: boolean;
  overlayActive?: boolean;
  terminal?: {
    active: number;
    count: number;
    hostIndex: number;
    hostCount: number;
    prompt: "prefix" | "confirm-close" | null;
    title?: string;
  };
};

const SEP = <Text dimColor> · </Text>;

function Hint({ bindings, label }: Readonly<{ bindings: KeyBinding[]; label?: string }>) {
  return <><Text color={palette.structure} bold>{bindings.map((key) => key.display).join("")}</Text><Text dimColor> {label ?? bindings[0].label}</Text></>;
}

export function Footer({ actionMessage, error, selectedKind, paneCount, focusedPane, canAddPane, canRemovePane, connectionStatus, canRetry, overlayActive, terminal }: Readonly<Props>) {
  if (terminal) {
    const content = terminal.prompt === "confirm-close"
      ? <Text color={palette.danger}>Close {terminal.title ?? "terminal"}? <Text bold>y</Text> yes · <Text bold>n/Esc</Text> cancel</Text>
      : terminal.prompt === "prefix"
      ? <Text wrap="wrap"><Text color={palette.structure} bold>d</Text> details · <Text color={palette.structure} bold>c</Text> new · <Text color={palette.structure} bold>x</Text> close · <Text color={palette.structure} bold>n/p</Text> select · <Text color={palette.structure} bold>&lt;/&gt;</Text> reorder · <Text color={palette.structure} bold>Tab</Text> host</Text>
      : <Text wrap="wrap"><Text color={palette.structure} bold>Ctrl+B</Text> commands · terminal {terminal.count ? terminal.active + 1 : 0}/{terminal.count} · <Text color={palette.structure} bold>Ctrl+B Tab</Text> host {terminal.hostIndex + 1}/{terminal.hostCount}</Text>;
    return <Box borderStyle="single" borderColor={palette.inactive} paddingX={1} width="100%">{content}</Box>;
  }

  const isProcess = selectedKind === "system-service";
  const multiPane = (paneCount ?? 1) > 1;
  const primary = isProcess ? monitorKeys.kill : monitorKeys.stop;
  const navigationHints: { bindings: KeyBinding[]; label?: string }[] = [
    ...(canAddPane ? [{ bindings: [monitorKeys.addPane] }] : []),
    ...(canRemovePane ? [{ bindings: [monitorKeys.closePane] }] : []),
    { bindings: [monitorKeys.hosts] },
    ...(multiPane ? [{ bindings: [monitorKeys.nextPane], label: `tab ${(focusedPane ?? 0) + 1}/${paneCount}` }] : []),
    { bindings: [monitorKeys.quit] },
  ];
  const hints: { bindings: KeyBinding[]; label?: string }[] = overlayActive
    ? [{ bindings: [monitorKeys.cancel] }]
    : connectionStatus && connectionStatus !== "online"
    ? [
        ...(canRetry ? [{ bindings: [monitorKeys.retry] }] : []),
        ...(connectionStatus === "needs-credential" ? [{ bindings: [monitorKeys.credentials] }] : []),
        ...navigationHints,
      ]
    : [
        { bindings: [monitorKeys.up, monitorKeys.down] },
        { bindings: [monitorKeys.restart] },
        { bindings: [primary] },
        ...(!isProcess ? [{ bindings: [monitorKeys.start] }] : []),
        { bindings: [monitorKeys.logs] },
        { bindings: [monitorKeys.terminal] },
        { bindings: [monitorKeys.search] },
        { bindings: [monitorKeys.filter] },
        { bindings: [monitorKeys.sort] },
        ...navigationHints,
      ];

  return (
    <Box borderStyle="single" borderColor={palette.inactive} paddingX={1} width="100%" flexDirection="column">
      {error && <Text color={palette.danger}>Error: {error}</Text>}
      {actionMessage && <Text color={palette.healthy}>{actionMessage}</Text>}
      <Box flexWrap="wrap">
        {hints.map((hint, index) => (
          <React.Fragment key={`${hint.bindings[0].display}-${hint.label ?? hint.bindings[0].label}`}>
            {index > 0 && SEP}
            <Hint {...hint} />
          </React.Fragment>
        ))}
      </Box>
    </Box>
  );
}
