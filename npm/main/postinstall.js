#!/usr/bin/env node
'use strict';

const { execFileSync } = require('node:child_process');
const { existsSync, writeFileSync, chmodSync } = require('node:fs');
const { join } = require('node:path');
const https = require('node:https');

const REPO = 'ACHRAF-YOUSSEF/homelab-tui';
const BIN_DIR = join(__dirname, 'bin');
const PLATFORM_MAP = {
  'linux-x64':   'homelab-tui-linux-x64',
  'linux-arm64': 'homelab-tui-linux-arm64',
  'darwin-x64':  'homelab-tui-darwin-x64',
  'darwin-arm64':'homelab-tui-darwin-arm64',
  'win32-x64':   'homelab-tui-windows-x64.exe',
};

const key = `${process.platform}-${process.arch}`;
const assetName = PLATFORM_MAP[key];

if (!assetName) {
  console.error(`homelab-tui: unsupported platform ${key}`);
  process.exit(1);
}

const version = require('./package.json').version;
const ext = process.platform === 'win32' ? '.exe' : '';
const dest = join(BIN_DIR, `homelab-tui${ext}`);

if (existsSync(dest)) process.exit(0); // already installed

const url = `https://github.com/${REPO}/releases/download/v${version}/${assetName}`;
console.log(`homelab-tui: downloading ${assetName} from GitHub releases…`);

require('node:fs').mkdirSync(BIN_DIR, { recursive: true });

function download(url, dest, cb) {
  const file = require('node:fs').createWriteStream(dest);
  https.get(url, (res) => {
    if (res.statusCode === 302 || res.statusCode === 301) {
      file.close();
      return download(res.headers.location, dest, cb);
    }
    if (res.statusCode !== 200) return cb(new Error(`HTTP ${res.statusCode}`));
    res.pipe(file);
    file.on('finish', () => file.close(cb));
  }).on('error', cb);
}

download(url, dest, (err) => {
  if (err) { console.error(`homelab-tui: download failed: ${err.message}`); process.exit(1); }
  if (process.platform !== 'win32') chmodSync(dest, 0o755);
  console.log(`homelab-tui: installed ${assetName}`);
});
