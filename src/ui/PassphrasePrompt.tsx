import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import type { HostConfig } from "../core/types.js";

type Props = {
  host: HostConfig;
  onSubmit: (passphrase: string) => void;
  onCancel: () => void;
};

export function PassphrasePrompt({ host, onSubmit, onCancel }: Readonly<Props>) {
  const [value, setValue] = useState("");

  useInput((_input, key) => {
    if (key.escape) onCancel();
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="double" borderColor="yellow" paddingX={2} paddingY={1} flexDirection="column">
        <Text bold color="yellow">SSH key passphrase required</Text>
        <Text> </Text>
        <Text dimColor>
          Host: <Text color="white">{host.username}@{host.host}:{host.port}</Text>
        </Text>
        <Text dimColor>
          Key:  <Text color="white">{host.privateKeyPath}</Text>
        </Text>
        <Text> </Text>
        <Box>
          <Text color="yellow">Passphrase: </Text>
          <TextInput
            value={value}
            onChange={setValue}
            onSubmit={() => onSubmit(value)}
            mask="*"
            focus
          />
        </Box>
        <Text> </Text>
        <Box gap={2}>
          <Text dimColor><Text color="cyan">Enter</Text> connect</Text>
          <Text dimColor><Text color="cyan">Esc</Text> cancel</Text>
        </Box>
      </Box>
    </Box>
  );
}
