import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { requireResolvedTenant } from "../../middleware/requireTenant";
import { validateBody, validateQuery } from "../../middleware/validate";
import { createDeliveryZoneSchema, updateDeliveryZoneSchema, getShippingCostQuerySchema } from "./delivery.schema";
import * as controller from "./delivery.controller";

const router = Router();

// Public storefront endpoint: get shipping cost for a region + cart amount
router.get("/shipping-cost", requireResolvedTenant, validateQuery(getShippingCostQuerySchema), asyncHandler(controller.getShippingCost));

// Admin CRUD
router.use(requireAuth(), requireRole("OWNER", "MANAGER"));
router.get("/", asyncHandler(controller.list));
router.post("/", validateBody(createDeliveryZoneSchema), asyncHandler(controller.create));
router.patch("/:id", validateBody(updateDeliveryZoneSchema), asyncHandler(controller.update));
router.delete("/:id", asyncHandler(controller.remove));

export { router as deliveryRouter };
