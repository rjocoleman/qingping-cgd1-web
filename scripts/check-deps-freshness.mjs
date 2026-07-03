#!/usr/bin/env node
// Warn when a dependency is a whole major version behind. Minor and patch
// drift is Dependabot's job; this catches the "shipped several majors stale"
// case before it goes out. Non-blocking on purpose - it is a heads-up, not a
// gate, so it never tempts anyone into --no-verify. Throttled to once a day so
// it does not slow every push.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CACHE_DIR = fileURLToPath(new URL('../node_modules/.cache/', import.meta.url));
const MARKER = `${CACHE_DIR}deps-freshness`;
const DAY_MS = 24 * 60 * 60 * 1000;

function checkedRecently() {
  try {
    return existsSync(MARKER) && Date.now() - statSync(MARKER).mtimeMs < DAY_MS;
  } catch {
    return false;
  }
}

function touchMarker() {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(MARKER, '');
  } catch {
    // best effort; a missing marker just means we check again next time
  }
}

function majorOf(version) {
  return Number.parseInt(
    String(version)
      .replace(/^[^\d]*/, '')
      .split('.')[0],
    10,
  );
}

if (checkedRecently()) process.exit(0);
touchMarker();

let raw = '';
try {
  // npm outdated exits non-zero when anything is outdated, but still prints
  // the JSON to stdout, so read it from the thrown error too.
  raw = execFileSync('npm', ['outdated', '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 20_000,
  });
} catch (err) {
  raw = err.stdout?.toString() ?? '';
}

let outdated = {};
try {
  outdated = JSON.parse(raw || '{}');
} catch {
  process.exit(0); // offline or unexpected output; skip quietly
}

const behind = [];
for (const [name, info] of Object.entries(outdated)) {
  const current = info.current ?? info.wanted;
  const { latest } = info;
  if (!current || !latest) continue;
  const currentMajor = majorOf(current);
  const latestMajor = majorOf(latest);
  if (Number.isFinite(currentMajor) && Number.isFinite(latestMajor) && latestMajor > currentMajor) {
    behind.push({ name, current, latest });
  }
}

if (behind.length > 0) {
  process.stderr.write('\n  These dependencies are a major version behind:\n');
  for (const { name, current, latest } of behind) {
    process.stderr.write(`    ${name}  ${current} -> ${latest}\n`);
  }
  process.stderr.write('  Run `npm outdated` for the full list before shipping.\n\n');
}

process.exit(0);
