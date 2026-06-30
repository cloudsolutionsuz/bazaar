import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { validateBody, validateQuery } from "../../middleware/validate";
import {
  bulkDiscountSchema,
  createPromotionSchema,
  listPromotionsQuerySchema,
  productSelectorSchema,
  updatePromotionSchema,
} from "./promotions.schema";
import * as promotionsController from "./promotions.controller";

export const promotionsRouter = Router();

promotionsRouter.use(requireAuth(), requireRole("OWNER", "MANAGER"));

promotionsRouter.post("/bulk-discount", validateBody(bulkDiscountSchema), asyncHandler(promotionsController.bulkDiscount));

promotionsRouter.get("/", validateQuery(listPromotionsQuerySchema), asyncHandler(promotionsController.list));
promotionsRouter.post("/", validateBody(createPromotionSchema), asyncHandler(promotionsController.create));
promotionsRouter.get("/:id", asyncHandler(promotionsController.get));
promotionsRouter.patch("/:id", validateBody(updatePromotionSchema), asyncHandler(promotionsController.update));
promotionsRouter.delete("/:id", asyncHandler(promotionsController.remove));

promotionsRouter.post("/:id/products", validateBody(productSelectorSchema), asyncHandler(promotionsController.attachProducts));
promotionsRouter.delete("/:id/products/:productId", asyncHandler(promotionsController.detachProduct));
