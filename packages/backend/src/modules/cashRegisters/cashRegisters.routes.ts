import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { validateBody } from "../../middleware/validate";
import { createCashRegisterSchema, updateCashRegisterSchema } from "./cashRegisters.schema";
import * as cashRegistersController from "./cashRegisters.controller";

export const cashRegistersRouter = Router();

cashRegistersRouter.use(requireAuth(), requireRole("OWNER", "MANAGER"));

cashRegistersRouter.get("/", asyncHandler(cashRegistersController.list));
cashRegistersRouter.post("/", validateBody(createCashRegisterSchema), asyncHandler(cashRegistersController.create));
cashRegistersRouter.patch("/:id", validateBody(updateCashRegisterSchema), asyncHandler(cashRegistersController.update));
