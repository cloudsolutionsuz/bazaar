import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { validateBody, validateQuery } from "../../middleware/validate";
import { createReceiptSchema, listMovementsQuerySchema } from "./inventory.schema";
import * as inventoryController from "./inventory.controller";

export const inventoryRouter = Router();

inventoryRouter.use(requireAuth(), requireRole("OWNER", "MANAGER"));

inventoryRouter.post("/receipts", validateBody(createReceiptSchema), asyncHandler(inventoryController.createReceipt));
inventoryRouter.get("/movements", validateQuery(listMovementsQuerySchema), asyncHandler(inventoryController.listMovements));
inventoryRouter.get("/low-stock", asyncHandler(inventoryController.listLowStock));
