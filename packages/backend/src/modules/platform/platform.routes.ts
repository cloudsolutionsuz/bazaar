import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { validateBody, validateQuery } from "../../middleware/validate";
import { listTenantsQuerySchema, updateTenantPlanSchema, updateTenantVipSchema } from "./platform.schema";
import * as platformController from "./platform.controller";

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
