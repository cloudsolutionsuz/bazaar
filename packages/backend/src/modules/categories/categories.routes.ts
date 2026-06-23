import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { validateBody } from "../../middleware/validate";
import { createCategorySchema, updateCategorySchema } from "./categories.schema";
import * as categoriesController from "./categories.controller";

export const categoriesRouter = Router();

categoriesRouter.use(requireAuth(), requireRole("OWNER", "MANAGER"));

categoriesRouter.get("/", asyncHandler(categoriesController.list));
categoriesRouter.post("/", validateBody(createCategorySchema), asyncHandler(categoriesController.create));
categoriesRouter.patch("/:id", validateBody(updateCategorySchema), asyncHandler(categoriesController.update));
categoriesRouter.delete("/:id", asyncHandler(categoriesController.remove));
