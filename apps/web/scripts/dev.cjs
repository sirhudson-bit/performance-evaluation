// Dev launcher that forces NODE_ENV=development.
//
// This machine exports NODE_ENV=production globally. If `next dev` inherits it,
// Next produces/serves production-like output and every route returns a bare
// 500 — so we set development explicitly, the same way the API's .env does.
process.env.NODE_ENV = 'development';

const { spawn } = require('node:child_process');

const port = process.env.PORT || '3000';
const nextBin = require.resolve('next/dist/bin/next');

const child = spawn(process.execPath, [nextBin, 'dev', '-p', port], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'development' },
});

child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
