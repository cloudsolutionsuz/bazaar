import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { validateBody, validateQuery } from "../../middleware/validate";
import { createOrderSchema, listOrdersQuerySchema, updateOrderStatusSchema } from "./orders.schema";
import * as ordersController from "./orders.controller";

export const ordersRouter = Router();

ordersRouter.use(requireAuth, requireRole("OWNER", "MANAGER", "CASHIER"));

ordersRouter.get("/export", asyncHandler(ordersController.exportOrders));

ordersRouter.get("/", validateQuery(listOrdersQuerySchema), asyncHandler(ordersController.list));
ordersRouter.post("/", validateBody(createOrderSchema), asyncHandler(ordersController.create));
ordersRouter.get("/:id", asyncHandler(ordersController.get));
ordersRouter.patch("/:id/status", validateBody(updateOrderStatusSchema), asyncHandler(ordersController.updateStatus));
