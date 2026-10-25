#!/usr/bin/env node
/*
 * Tolerant postinstall.
 *
 * Generating the Prisma client here means a plain `npm install` leaves the
 * project runnable. It never fails the install: if the Prisma CLI is absent
 * (e.g. a production install without devDependencies) it only warns, and
 * `npm run dev` will generate the client on demand.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const isWin = process.platform === 'win32';
const prismaBin = path.join(ROOT, 'node_modules', '.bin', isWin ? 'prisma.cmd' : 'prisma');

if (!fs.existsSync(prismaBin)) {
  console.warn('[postinstall] Prisma CLI not found (devDependencies skipped?). Run: npm install --include=dev');
  process.exit(0);
}

const result = spawnSync(prismaBin, ['generate'], { stdio: 'inherit', cwd: ROOT, shell: isWin });
if (result.status !== 0) {
  console.warn('[postinstall] `prisma generate` failed; `npm run dev` will retry.');
}
process.exit(0);
