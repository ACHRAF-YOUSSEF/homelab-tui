#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');
const { join } = require('node:path');
const { existsSync } = require('node:fs');

const ext = process.platform === 'win32' ? '.exe' : '';
const binary = join(__dirname, 'bin', `homelab-tui${ext}`);

if (!existsSync(binary)) {
  process.stderr.write(
    'homelab-tui: binary not found. Try reinstalling: npm install -g homelab-tui\n'
  );
  process.exit(1);
}

const result = spawnSync(binary, process.argv.slice(2), { stdio: 'inherit' });
process.exit(result.status ?? 1);
