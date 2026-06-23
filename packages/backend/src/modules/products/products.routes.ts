import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { validateBody, validateQuery } from "../../middleware/validate";
import { uploadProductImages, uploadSpreadsheet } from "../../middleware/upload";
import {
  createProductSchema,
  createVariantSchema,
  listProductsQuerySchema,
  reorderImagesSchema,
  updateProductSchema,
  updateVariantSchema,
} from "./products.schema";
import * as productsController from "./products.controller";

export const productsRouter = Router();

productsRouter.use(requireAuth(), requireRole("OWNER", "MANAGER"));

productsRouter.get("/export", asyncHandler(productsController.exportProducts));
productsRouter.post("/import", uploadSpreadsheet, asyncHandler(productsController.importProducts));

productsRouter.get("/", validateQuery(listProductsQuerySchema), asyncHandler(productsController.list));
productsRouter.post("/", validateBody(createProductSchema), asyncHandler(productsController.create));
productsRouter.get("/:id", asyncHandler(productsController.get));
productsRouter.patch("/:id", validateBody(updateProductSchema), asyncHandler(productsController.update));
productsRouter.delete("/:id", asyncHandler(productsController.remove));

productsRouter.post("/:productId/variants", validateBody(createVariantSchema), asyncHandler(productsController.createVariant));
productsRouter.patch("/:productId/variants/:variantId", validateBody(updateVariantSchema), asyncHandler(productsController.updateVariant));
productsRouter.delete("/:productId/variants/:variantId", asyncHandler(productsController.deleteVariant));

productsRouter.post("/:id/images", uploadProductImages, asyncHandler(productsController.uploadImages));
productsRouter.delete("/:id/images/:imageId", asyncHandler(productsController.deleteImage));
productsRouter.patch("/:id/images/reorder", validateBody(reorderImagesSchema), asyncHandler(productsController.reorderImages));
