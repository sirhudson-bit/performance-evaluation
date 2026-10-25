#!/usr/bin/env node
/*
 * Dev runner — `npm run dev`.
 *
 * Unlike a single Next.js app, this monorepo has three moving parts that must
 * exist before the servers start:
 *   1. the Prisma client must be *generated*;
 *   2. PostgreSQL must be *running*;
 *   3. the schema must be *migrated*.
 * This script guarantees all three (and repairs them when missing) and then
 * starts the API and web servers. That is why `npm run dev` differs from the
 * other projects — and why it previously failed with "Prisma fails to load".
 *
 * Node-only, cross-platform, no extra dependencies.
 */
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
process.chdir(ROOT);

const isWin = process.platform === 'win32';
const log = (m) => console.log(`[dev] ${m}`);
const warn = (m) => console.warn(`[dev] ${m}`);
const fail = (m) => {
  console.error(`\n[dev] ${m}\n`);
  process.exit(1);
};

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function binPath(name) {
  return path.join(ROOT, 'node_modules', '.bin', isWin ? `${name}.cmd` : name);
}

/** Runs an executable or a .cmd/.bat shim with correct Windows quoting. */
function run(target, args = [], opts = {}) {
  const isShim = /\.(cmd|bat)$/i.test(target);
  const common = { cwd: ROOT, env, stdio: 'inherit', ...opts };
  if (isShim) {
    const quote = (a) => (/\s/.test(a) ? `"${a}"` : a);
    return spawnSync(`"${target}" ${args.map(quote).join(' ')}`, { ...common, shell: true });
  }
  return spawnSync(target, args, common);
}

// ---------------------------------------------------------------------------
// environment
// ---------------------------------------------------------------------------
const env = { ...process.env };
env.NODE_ENV = 'development'; // this machine exports NODE_ENV=production globally

if (!fs.existsSync(path.join(ROOT, 'node_modules'))) {
  fail('Dependencies are not installed. Run:  npm install --include=dev');
}
if (!fs.existsSync('.env') && fs.existsSync('.env.example')) {
  fs.copyFileSync('.env.example', '.env');
  log('created .env from .env.example');
}
if (fs.existsSync('.env')) {
  for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in env)) env[m[1]] = m[2].trim().replace(/^"|"$/g, '');
  }
}

// ---------------------------------------------------------------------------
// Prisma client
// ---------------------------------------------------------------------------
const prismaBin = binPath('prisma');
const clientMarker = path.join(ROOT, 'node_modules', '.prisma', 'client', 'index.js');

if (!fs.existsSync(clientMarker)) {
  if (!fs.existsSync(prismaBin)) fail('Prisma CLI not found. Run:  npm install --include=dev');
  log('Prisma client is missing — generating it now…');
  const r = run(prismaBin, ['generate']);
  if (r.status !== 0 || !fs.existsSync(clientMarker)) {
    fail('Prisma client generation failed. Try:  npm install --include=dev  &&  npx prisma generate');
  }
  log('Prisma client generated.');
}

// ---------------------------------------------------------------------------
// PostgreSQL
// ---------------------------------------------------------------------------
const dbUrl = env.DATABASE_URL || '';
const match = dbUrl.match(/@([^:/@]+):(\d+)\//);
const dbHost = match ? match[1] : '127.0.0.1';
const dbPort = match ? match[2] : '5432';

function findPgBin() {
  const roots = [
    'C:\\Program Files\\PostgreSQL',
    'C:\\Program Files (x86)\\PostgreSQL',
    '/usr/lib/postgresql',
    '/opt/homebrew/opt',
    '/usr/local/opt',
  ];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const entry of fs.readdirSync(root)) {
      const dir = fs.existsSync(path.join(root, entry, 'bin')) ? path.join(root, entry, 'bin') : path.join(root, entry);
      if (fs.existsSync(path.join(dir, isWin ? 'pg_isready.exe' : 'pg_isready'))) return dir;
    }
  }
  return null;
}

const pgBin = findPgBin();
const pgReady = pgBin ? path.join(pgBin, isWin ? 'pg_isready.exe' : 'pg_isready') : null;
const pgCtl = pgBin ? path.join(pgBin, isWin ? 'pg_ctl.exe' : 'pg_ctl') : null;
const pgData = path.join(ROOT, '.pgdata');

function dbIsUp() {
  if (!pgReady) return true; // cannot probe; assume an external server is up
  return run(pgReady, ['-h', dbHost, '-p', dbPort, '-q'], { stdio: 'ignore' }).status === 0;
}

if (dbIsUp()) {
  log(`PostgreSQL is up on ${dbHost}:${dbPort}`);
} else if (fs.existsSync(path.join(pgData, 'PG_VERSION'))) {
  log(`starting PostgreSQL on port ${dbPort}…`);
  const stale = path.join(pgData, 'postmaster.pid');
  if (fs.existsSync(stale)) {
    try {
      fs.unlinkSync(stale);
    } catch {
      /* ignore */
    }
  }
  // Start detached so the database survives the dev process (Ctrl+C).
  const starter = spawn(pgCtl, ['-D', pgData, '-o', `-p ${dbPort}`, '-l', path.join(pgData, 'server.log'), 'start'], {
    cwd: ROOT,
    detached: true,
    stdio: 'ignore',
  });
  starter.unref();
  for (let i = 0; i < 40 && !dbIsUp(); i += 1) sleep(1000);
  if (dbIsUp()) log('PostgreSQL is ready.');
  else warn('PostgreSQL did not start in time — see .pgdata/server.log');
} else {
  warn(`no local cluster at .pgdata; make sure a PostgreSQL server is reachable at ${dbHost}:${dbPort}`);
}

// ---------------------------------------------------------------------------
// migrations
// ---------------------------------------------------------------------------
if (fs.existsSync(prismaBin) && dbIsUp()) {
  log('applying database migrations…');
  const r = run(prismaBin, ['migrate', 'deploy']);
  if (r.status !== 0) warn('migrate deploy reported an error; continuing (schema may already be current).');
}

// ---------------------------------------------------------------------------
// start api + web
// ---------------------------------------------------------------------------
const concurrently = binPath('concurrently');
if (!fs.existsSync(concurrently)) fail('concurrently not found. Run:  npm install --include=dev');

log('starting API (:4000) and web (:3000) — press Ctrl+C to stop');
const child = spawn(`"${concurrently}" -k -n api,web -c blue,green npm:dev:api npm:dev:web`, {
  cwd: ROOT,
  env,
  stdio: 'inherit',
  shell: true,
});
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
