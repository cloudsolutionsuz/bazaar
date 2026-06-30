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
import { storefrontRouter } from "./modules/storefront/storefront.routes";
import { billingRouter } from "./modules/billing/billing.routes";
import { employeesRouter } from "./modules/employees/employees.routes";
import { financeRouter } from "./modules/finance/finance.routes";
import { platformRouter } from "./modules/platform/platform.routes";
import { bannersRouter } from "./modules/banners/banners.routes";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes";
import { customersRouter } from "./modules/customers/customers.routes";
import { suppliersRouter } from "./modules/suppliers/suppliers.routes";
import { cashRegistersRouter } from "./modules/cashRegisters/cashRegisters.routes";
import { chatRouter } from "./modules/chat/chat.routes";
import { aiAdvisorRouter } from "./modules/aiAdvisor/aiAdvisor.routes";
import { promotionsRouter } from "./modules/promotions/promotions.routes";

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
  app.use("/api/storefront", storefrontRouter);
  app.use("/api/billing", billingRouter);
  app.use("/api/employees", employeesRouter);
  app.use("/api/finance", financeRouter);
  app.use("/api/platform", platformRouter);
  app.use("/api/banners", bannersRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/customers", customersRouter);
  app.use("/api/suppliers", suppliersRouter);
  app.use("/api/cash-registers", cashRegistersRouter);
  app.use("/api/chat", chatRouter);
  app.use("/api/ai-advisor", aiAdvisorRouter);
  app.use("/api/promotions", promotionsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
