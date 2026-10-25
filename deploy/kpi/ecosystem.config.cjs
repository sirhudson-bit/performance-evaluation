// pm2 process definition for kpi.namirahamrah.ir.
//
//   APP_DIR=/var/www/kpi WEB_PORT=3002 API_PORT=4000 \
//     pm2 startOrReload deploy/kpi/ecosystem.config.cjs --update-env
//
// Three processes on purpose:
//   kpi-api  — Express API, loopback only (the Next server proxies /api/v1 to it)
//   kpi-web  — Next.js, loopback only (nginx is the single public entry point)
//   kpi-worker — bounded background job drainer
const appDir = process.env.APP_DIR || "/var/www/kpi";
const webPort = process.env.WEB_PORT || "3002";
const apiPort = process.env.API_PORT || "4000";
const appName = process.env.APP_NAME || "kpi";
const node = process.execPath;

const shared = {
  cwd: appDir,
  exec_mode: "fork",
  instances: 1,
  autorestart: true,
  min_uptime: "20s",
  max_restarts: 10,
  time: true,
  merge_logs: true,
  out_file: `/var/log/${appName}/out.log`,
  error_file: `/var/log/${appName}/error.log`,
};

module.exports = {
  apps: [
    {
      ...shared,
      name: `${appName}-api`,
      // TypeScript straight through tsx: the API has no build output, `npm run
      // build -w @pe/api` is a typecheck only. Avoids a stale dist/ directory.
      script: node,
      args: "--import tsx apps/api/src/index.ts",
      env: {
        NODE_ENV: "production",
        API_PORT: String(apiPort),
      },
      max_memory_restart: "512M",
    },
    {
      ...shared,
      name: `${appName}-web`,
      cwd: `${appDir}/apps/web`,
      script: `${appDir}/node_modules/next/dist/bin/next`,
      args: `start -p ${webPort} --hostname 127.0.0.1`,
      env: {
        NODE_ENV: "production",
        PORT: String(webPort),
        // Baked into the Next rewrite at build time — keep the two in step.
        API_URL: `http://127.0.0.1:${apiPort}`,
      },
      max_memory_restart: "768M",
    },
    {
      ...shared,
      name: `${appName}-worker`,
      script: node,
      args: "--import tsx apps/worker/src/index.ts",
      env: {
        NODE_ENV: "production",
      },
      max_memory_restart: "384M",
    },
  ],
};
