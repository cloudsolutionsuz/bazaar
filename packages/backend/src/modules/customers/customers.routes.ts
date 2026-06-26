import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { validateQuery } from "../../middleware/validate";
import { listCustomersQuerySchema } from "./customers.schema";
import * as customersController from "./customers.controller";

export const customersRouter = Router();

customersRouter.use(requireAuth(), requireRole("OWNER", "MANAGER"));

customersRouter.get("/", validateQuery(listCustomersQuerySchema), asyncHandler(customersController.list));
