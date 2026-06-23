import express, { type Express } from "express";
import cors from "cors";
import { UPLOADS_DIR } from "./config/paths";
import { resolveTenant } from "./middleware/resolveTenant";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { authRouter } from "./modules/auth/auth.routes";
import { tenantsRouter } from "./modules/tenants/tenants.routes";
import { plansRouter } from "./modules/plans/plans.routes";
import { categoriesRouter } from "./modules/categories/categories.routes";
import { productsRouter } from "./modules/products/products.routes";
import { inventoryRouter } from "./modules/inventory/inventory.routes";
import { ordersRouter } from "./modules/orders/orders.routes";

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(resolveTenant);
  app.use("/uploads", express.static(UPLOADS_DIR));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/tenants", tenantsRouter);
  app.use("/api/plans", plansRouter);
  app.use("/api/categories", categoriesRouter);
  app.use("/api/products", productsRouter);
  app.use("/api/inventory", inventoryRouter);
  app.use("/api/orders", ordersRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
