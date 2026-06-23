import { createApp } from "./app";
import { env } from "./config/env";
import { runBillingCycle } from "./modules/billing/billing.service";

const app = createApp();

app.listen(env.port, () => {
  console.log(`Bazaar backend listening on http://localhost:${env.port}`);
});

// Stand-in for a real cron/job-scheduler in production (e.g. system cron
// hitting POST /api/billing/run-cycle, or a proper job queue). Fine for a
// single long-running dev/demo process, not for a multi-instance deployment.
const BILLING_CYCLE_INTERVAL_MS = 60 * 60 * 1000;
setInterval(() => {
  runBillingCycle().catch((err) => console.error("[billing] cycle run failed", err));
}, BILLING_CYCLE_INTERVAL_MS);
