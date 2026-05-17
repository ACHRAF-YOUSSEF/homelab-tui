import React from "react";
import { Box, Text } from "ink";
import type { ServiceKind } from "../core/types.js";

type Props = {
  actionMessage: string | null;
  error: string | null;
  selectedKind?: ServiceKind;
  paneCount?: number;
  focusedPane?: number;
  canAddPane?: boolean;
  canRemovePane?: boolean;
};

const KEY = (k: string) => <Text color="cyan" bold>{k}</Text>;
const SEP = <Text dimColor> · </Text>;

export function Footer({ actionMessage, error, selectedKind, paneCount, focusedPane, canAddPane, canRemovePane }: Readonly<Props>) {
  const isProcess = selectedKind === "system-service";
  const multiPane = (paneCount ?? 1) > 1;

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1} width="100%" flexDirection="column">
      {error && <Text color="red">Error: {error}</Text>}
      {actionMessage && <Text color="green">{actionMessage}</Text>}
      <Box flexWrap="wrap">
        {KEY("↑↓")}
        <Text dimColor> select</Text>
        {SEP}
        {isProcess ? (
          <>
            {KEY("r")}
            <Text dimColor> restart</Text>
            {SEP}
            {KEY("s")}
            <Text dimColor> kill</Text>
          </>
        ) : (
          <>
            {KEY("r")}
            <Text dimColor> restart</Text>
            {SEP}
            {KEY("s")}
            <Text dimColor> stop</Text>
            {SEP}
            {KEY("t")}
            <Text dimColor> start</Text>
          </>
        )}
        {SEP}
        {KEY("l")}
        <Text dimColor> logs</Text>
        {SEP}
        {KEY("/")}
        <Text dimColor> search</Text>
        {SEP}
        {KEY("f")}
        <Text dimColor> filter</Text>
        {SEP}
        {KEY("o")}
        <Text dimColor> sort</Text>
        {SEP}
        {canAddPane && (
          <>
            {KEY("a")}
            <Text dimColor> add pane</Text>
            {SEP}
          </>
        )}
        {canRemovePane && (
          <>
            {KEY("x")}
            <Text dimColor> close pane</Text>
            {SEP}
          </>
        )}
        {multiPane && (
          <>
            {KEY("<")}
            {KEY(">")}
            <Text dimColor> swap pane</Text>
            {SEP}
            {KEY("Tab")}
            <Text dimColor> pane {(focusedPane ?? 0) + 1}/{paneCount}</Text>
            {SEP}
          </>
        )}
        {KEY("h")}
        <Text dimColor> hosts</Text>
        {SEP}
        {KEY("q")}
        <Text dimColor> quit</Text>
      </Box>
    </Box>
  );
}
