import React from "react";
import { Box, Text } from "ink";

type Props = {
  logs: string | null;
  serviceName: string | null;
};

export function LogPanel({ logs, serviceName }: Readonly<Props>) {
  if (!logs) return null;

  const lines = logs.split("\n").slice(-20);

  return (
    <Box
      borderStyle="single"
      borderColor="yellow"
      paddingX={1}
      flexDirection="column"
      height={12}
    >
      <Text bold color="yellow">
        Logs: {serviceName ?? "—"}
      </Text>
      {lines.map((line, i) => (
        <Text key={i} dimColor wrap="truncate">
          {line}
        </Text>
      ))}
    </Box>
  );
}
