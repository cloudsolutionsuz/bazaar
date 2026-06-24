import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { validateBody } from "../../middleware/validate";
import { uploadBannerImage } from "../../middleware/upload";
import { createBannerSchema, reorderBannersSchema, updateBannerSchema } from "./banners.schema";
import * as bannersController from "./banners.controller";

export const bannersRouter = Router();

bannersRouter.use(requireAuth(), requireRole("OWNER", "MANAGER"));

bannersRouter.get("/", asyncHandler(bannersController.list));
bannersRouter.post("/", uploadBannerImage, validateBody(createBannerSchema), asyncHandler(bannersController.create));
bannersRouter.patch("/reorder", validateBody(reorderBannersSchema), asyncHandler(bannersController.reorder));
bannersRouter.patch("/:id", validateBody(updateBannerSchema), asyncHandler(bannersController.update));
bannersRouter.delete("/:id", asyncHandler(bannersController.remove));
