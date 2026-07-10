import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { validateBody, validateQuery } from "../../middleware/validate";
import { listTenantsQuerySchema, updateTenantPlanSchema, updateTenantVipSchema } from "./platform.schema";
import * as platformController from "./platform.controller";
import * as supportController from "../support/support.controller";
import { z } from "zod";
const sendSupportMessageSchema = z.object({ text: z.string().min(1).max(5000) });

export const platformRouter = Router();

platformRouter.use(requireAuth(), requireRole("SUPER_ADMIN"));

platformRouter.get("/tenants", validateQuery(listTenantsQuerySchema), asyncHandler(platformController.listTenants));
platformRouter.get("/tenants/:id", asyncHandler(platformController.getTenantDetail));
platformRouter.patch(
  "/tenants/:id/plan",
  validateBody(updateTenantPlanSchema),
  asyncHandler(platformController.updateTenantPlan),
);
platformRouter.patch(
  "/tenants/:id/vip",
  validateBody(updateTenantVipSchema),
  asyncHandler(platformController.updateTenantVip),
);
platformRouter.get("/stats", asyncHandler(platformController.getStats));
platformRouter.get("/billing-timeline", validateQuery(listTenantsQuerySchema), asyncHandler(platformController.getBillingTimeline));
platformRouter.get("/tenants/:id/reports", asyncHandler(platformController.getTenantReports));
platformRouter.get("/tenants/:id/reports/products", asyncHandler(platformController.getTenantProductsReport));
platformRouter.get("/tenants/:id/reports/payments", asyncHandler(platformController.getTenantPaymentsReport));

// Support chat (super admin side)
platformRouter.get("/support", asyncHandler(supportController.listChats));
platformRouter.get("/support/unread", asyncHandler(supportController.getSuperAdminUnreadCount));
platformRouter.get("/support/:tenantId/messages", asyncHandler(supportController.getTenantMessages));
platformRouter.post(
  "/support/:tenantId/messages",
  validateBody(sendSupportMessageSchema),
  asyncHandler(supportController.replyToTenant),
);
