import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { validateBody, validateQuery } from "../../middleware/validate";
import {
  createReceiptSchema,
  createStocktakeSchema,
  createSupplierReturnSchema,
  createWriteOffSchema,
  dailyReportQuerySchema,
  listMovementsQuerySchema,
} from "./inventory.schema";
import * as inventoryController from "./inventory.controller";

export const inventoryRouter = Router();

inventoryRouter.use(requireAuth(), requireRole("OWNER", "MANAGER"));

inventoryRouter.get("/export", asyncHandler(inventoryController.exportInventory));
inventoryRouter.get("/daily-report", validateQuery(dailyReportQuerySchema), asyncHandler(inventoryController.getDailyReport));
inventoryRouter.post("/receipts", validateBody(createReceiptSchema), asyncHandler(inventoryController.createReceipt));
inventoryRouter.post("/write-offs", validateBody(createWriteOffSchema), asyncHandler(inventoryController.createWriteOff));
inventoryRouter.post(
  "/supplier-returns",
  validateBody(createSupplierReturnSchema),
  asyncHandler(inventoryController.createSupplierReturn),
);
inventoryRouter.post("/stocktakes", validateBody(createStocktakeSchema), asyncHandler(inventoryController.createStocktake));
inventoryRouter.get("/movements", validateQuery(listMovementsQuerySchema), asyncHandler(inventoryController.listMovements));
inventoryRouter.get("/low-stock", asyncHandler(inventoryController.listLowStock));
