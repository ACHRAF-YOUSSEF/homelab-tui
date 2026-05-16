import React, { useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import TextInput from "ink-text-input";
import { existsSync } from "node:fs";
import { saveConfig } from "../config/loader.js";
import { saveSettings, loadSettings } from "../config/settings.js";

type Stage = "menu" | "enter-path" | "confirm-create";

const MENU = [
  { id: "create", label: "Create new config at this path" },
  { id: "custom", label: "Enter a different path" },
  { id: "quit",   label: "Quit" },
] as const;

type Props = {
  defaultPath: string;
  onConfigReady: (path: string) => void;
};

export function ConfigSetup({ defaultPath, onConfigReady }: Readonly<Props>) {
  const { exit } = useApp();
  const [stage, setStage] = useState<Stage>("menu");
  const [menuIndex, setMenuIndex] = useState(0);
  const [customPath, setCustomPath] = useState("");
  const [hint, setHint] = useState<string | null>(null);

  useInput((_input, key) => {
    if (stage === "menu") {
      if (key.upArrow) { setMenuIndex((i) => Math.max(0, i - 1)); return; }
      if (key.downArrow) { setMenuIndex((i) => Math.min(MENU.length - 1, i + 1)); return; }
      if (key.return) {
        const choice = MENU[menuIndex].id;
        if (choice === "create") { createAndReady(defaultPath); return; }
        if (choice === "custom") { setStage("enter-path"); return; }
        exit();
      }
    }
    if (stage === "enter-path" && key.escape) {
      setStage("menu");
      setCustomPath("");
      setHint(null);
    }
    if (stage === "confirm-create") {
      if (_input === "y" || key.return) { createAndReady(customPath); return; }
      if (_input === "n" || key.escape) { setStage("enter-path"); setHint(null); }
    }
  });

  function createAndReady(path: string) {
    try {
      saveConfig({ hosts: [] }, path);
      const settings = loadSettings();
      settings.configPath = path;
      saveSettings(settings);
      onConfigReady(path);
    } catch (err: unknown) {
      setHint(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function handlePathSubmit() {
    const p = customPath.trim();
    if (!p) return;
    if (existsSync(p)) {
      // File exists — load it
      const settings = loadSettings();
      settings.configPath = p;
      saveSettings(settings);
      onConfigReady(p);
    } else {
      // File doesn't exist — ask to create
      setStage("confirm-create");
    }
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="double" borderColor="yellow" paddingX={2} paddingY={1} flexDirection="column">
        <Text bold color="yellow">Config file not found</Text>
        <Text> </Text>
        <Text dimColor>{defaultPath}</Text>
        <Text> </Text>

        {stage === "menu" && (
          <>
            {MENU.map((item, i) => (
              <Text
                key={item.id}
                color={i === menuIndex ? "white" : "gray"}
                bold={i === menuIndex}
                inverse={i === menuIndex}
              >
                {i === menuIndex ? "> " : "  "}{item.label}
              </Text>
            ))}
            <Text> </Text>
            <Box gap={2}>
              <Text dimColor><Text color="cyan">↑↓</Text> select</Text>
              <Text dimColor><Text color="cyan">Enter</Text> confirm</Text>
            </Box>
          </>
        )}

        {stage === "enter-path" && (
          <>
            <Text dimColor>Enter config path:</Text>
            <Box>
              <Text color="cyan">→ </Text>
              <TextInput
                value={customPath}
                onChange={setCustomPath}
                onSubmit={handlePathSubmit}
                focus
                placeholder="/path/to/homelab.config.json"
              />
            </Box>
            {hint && <Text color="red">{hint}</Text>}
            <Text> </Text>
            <Box gap={2}>
              <Text dimColor><Text color="cyan">Enter</Text> confirm</Text>
              <Text dimColor><Text color="cyan">Esc</Text> back</Text>
            </Box>
          </>
        )}

        {stage === "confirm-create" && (
          <>
            <Text>Create new config at:</Text>
            <Text color="cyan">{customPath}</Text>
            <Text> </Text>
            <Text><Text color="cyan">y</Text> / <Text color="cyan">Enter</Text> yes  <Text color="cyan">n</Text> / <Text color="cyan">Esc</Text> no</Text>
            {hint && <Text color="red">{hint}</Text>}
          </>
        )}
      </Box>
    </Box>
  );
}
