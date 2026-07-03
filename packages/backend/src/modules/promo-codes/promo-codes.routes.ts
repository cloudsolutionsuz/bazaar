import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { requireResolvedTenant } from "../../middleware/requireTenant";
import { validateBody, validateQuery } from "../../middleware/validate";
import { createPromoCodeSchema, listPromoCodesQuerySchema, validatePromoCodeQuerySchema } from "./promo-codes.schema";
import * as controller from "./promo-codes.controller";

const router = Router();

// Storefront: validate promo code (no auth — called from checkout page via subdomain)
router.get(
  "/validate",
  requireResolvedTenant,
  validateQuery(validatePromoCodeQuerySchema),
  asyncHandler(controller.validatePromoCode),
);

// Admin CRUD
router.use(requireAuth(), requireRole("OWNER", "MANAGER"));

router.get("/", validateQuery(listPromoCodesQuerySchema), asyncHandler(controller.listPromoCodes));
router.post("/", validateBody(createPromoCodeSchema), asyncHandler(controller.createPromoCode));
router.delete("/:id", asyncHandler(controller.deactivatePromoCode));

export { router as promoCodesRouter };
