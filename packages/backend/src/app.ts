import express, { type Express } from "express";
import cors from "cors";
import { resolveTenant } from "./middleware/resolveTenant";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { authRouter } from "./modules/auth/auth.routes";
import { tenantsRouter } from "./modules/tenants/tenants.routes";
import { plansRouter } from "./modules/plans/plans.routes";

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(resolveTenant);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/tenants", tenantsRouter);
  app.use("/api/plans", plansRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
