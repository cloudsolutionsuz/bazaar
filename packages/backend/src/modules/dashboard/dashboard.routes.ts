import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { validateQuery } from "../../middleware/validate";
import * as dashboardController from "./dashboard.controller";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth(), requireRole("OWNER", "MANAGER"));

export const dashboardSummaryQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

dashboardRouter.get("/summary", validateQuery(dashboardSummaryQuerySchema), asyncHandler(dashboardController.getSummary));
