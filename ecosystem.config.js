// PM2 reference config - alternative to Docker for running the backend
// directly on a VPS (no containers). Not yet deployed/tested (no VPS
// provisioned - see project notes).
//
// Usage on the server, after `npm ci && npm run build` from the repo root:
//   pm2 start ecosystem.config.js
//
// instances is pinned to 1 on purpose: server.ts runs the billing cycle via
// an in-process setInterval (see src/server.ts) that keeps no shared state
// across processes - running 2+ instances would fire that job twice per
// tick. If this ever needs to scale horizontally, move the billing cycle to
// a proper external scheduler (system cron hitting POST /api/billing/run-cycle,
// or a job queue) first, then lift this restriction.
module.exports = {
  apps: [
    {
      name: "bazaar-backend",
      cwd: "./packages/backend",
      script: "dist/server.js",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
