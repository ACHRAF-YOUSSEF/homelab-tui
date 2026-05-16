import React from "react";
import { Box, Text } from "ink";

type Props = {
  actionMessage: string | null;
  error: string | null;
};

const KEY = (k: string) => <Text color="cyan" bold>{k}</Text>;
const SEP = <Text dimColor> · </Text>;

export function Footer({ actionMessage, error }: Readonly<Props>) {
  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1} flexDirection="column">
      {error && <Text color="red">Error: {error}</Text>}
      {actionMessage && <Text color="green">{actionMessage}</Text>}
      <Box flexWrap="wrap">
        {KEY("↑↓")}
        <Text dimColor> select</Text>
        {SEP}
        {KEY("r")}
        <Text dimColor> restart</Text>
        {SEP}
        {KEY("s")}
        <Text dimColor> stop</Text>
        {SEP}
        {KEY("t")}
        <Text dimColor> start</Text>
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
        {KEY("h")}
        <Text dimColor> hosts</Text>
        {SEP}
        {KEY("q")}
        <Text dimColor> quit</Text>
      </Box>
    </Box>
  );
}
