import React from "react";
import { render } from "ink";
import { loadConfig } from "./config/loader.js";
import { Root } from "./ui/Root.js";

let config;
try {
  config = loadConfig() ?? { hosts: [] };
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Config error: ${msg}\n`);
  process.exit(1);
}

render(<Root initialConfig={config} />);
