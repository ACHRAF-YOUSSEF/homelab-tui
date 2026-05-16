#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const PLATFORM_PACKAGES = {
  'linux-x64':   'homelab-tui-linux-x64',
  'linux-arm64': 'homelab-tui-linux-arm64',
  'darwin-x64':  'homelab-tui-darwin-x64',
  'darwin-arm64':'homelab-tui-darwin-arm64',
  'win32-x64':   'homelab-tui-windows-x64',
};

const key = `${process.platform}-${process.arch}`;
const pkgName = PLATFORM_PACKAGES[key];

if (!pkgName) {
  process.stderr.write(
    `homelab-tui: unsupported platform "${key}"\n` +
    `Supported: ${Object.keys(PLATFORM_PACKAGES).join(', ')}\n`
  );
  process.exit(1);
}

let binaryPath;
try {
  const pkgDir = path.dirname(require.resolve(`${pkgName}/package.json`));
  const ext = process.platform === 'win32' ? '.exe' : '';
  binaryPath = path.join(pkgDir, 'bin', `homelab-tui${ext}`);
} catch {
  process.stderr.write(
    `homelab-tui: platform package "${pkgName}" is missing.\n` +
    `Try reinstalling: npm install -g homelab-tui\n`
  );
  process.exit(1);
}

const result = spawnSync(binaryPath, process.argv.slice(2), { stdio: 'inherit' });
process.exit(result.status ?? 1);
