import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { validateBody, validateQuery } from "../../middleware/validate";
import {
  createSupplierPaymentSchema,
  createSupplierSchema,
  listSuppliersQuerySchema,
  supplierStatementQuerySchema,
  updateSupplierSchema,
} from "./suppliers.schema";
import * as suppliersController from "./suppliers.controller";

export const suppliersRouter = Router();

suppliersRouter.use(requireAuth(), requireRole("OWNER", "MANAGER"));

suppliersRouter.get("/", validateQuery(listSuppliersQuerySchema), asyncHandler(suppliersController.list));
suppliersRouter.post("/", validateBody(createSupplierSchema), asyncHandler(suppliersController.create));
suppliersRouter.patch("/:id", validateBody(updateSupplierSchema), asyncHandler(suppliersController.update));
suppliersRouter.delete("/:id", asyncHandler(suppliersController.remove));
suppliersRouter.get(
  "/:id/statement",
  validateQuery(supplierStatementQuerySchema),
  asyncHandler(suppliersController.getStatement),
);
suppliersRouter.get(
  "/:id/statement/export",
  validateQuery(supplierStatementQuerySchema),
  asyncHandler(suppliersController.exportStatement),
);
suppliersRouter.post(
  "/:id/payments",
  validateBody(createSupplierPaymentSchema),
  asyncHandler(suppliersController.createPayment),
);
