import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { validateBody } from "../../middleware/validate";
import { askSchema } from "./aiAdvisor.schema";
import * as aiAdvisorController from "./aiAdvisor.controller";

export const aiAdvisorRouter = Router();

aiAdvisorRouter.use(requireAuth(), requireRole("OWNER", "MANAGER"));

aiAdvisorRouter.post("/ask", validateBody(askSchema), asyncHandler(aiAdvisorController.ask));
