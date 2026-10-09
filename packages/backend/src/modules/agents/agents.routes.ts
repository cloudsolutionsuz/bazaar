import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { validateBody, validateQuery } from "../../middleware/validate";
import { uploadSpreadsheet } from "../../middleware/upload";
import {
  agentPeriodQuerySchema,
  agentSalesQuerySchema,
  bulkBonusSchema,
  createAgentSchema,
  createPayoutSchema,
  updateAgentSchema,
} from "./agents.schema";
import * as agentsController from "./agents.controller";

export const agentsRouter = Router();

agentsRouter.use(requireAuth());

// Reports: open to agents too, but the controller locks an AGENT login to
// its own data (see agentScope).
const canViewReports = requireRole("OWNER", "MANAGER", "AGENT");
agentsRouter.get("/me", requireRole("AGENT"), asyncHandler(agentsController.me));
agentsRouter.get("/sales", canViewReports, validateQuery(agentSalesQuerySchema), asyncHandler(agentsController.sales));
agentsRouter.get("/payouts", canViewReports, validateQuery(agentPeriodQuerySchema), asyncHandler(agentsController.payouts));
agentsRouter.get("/reconciliation", canViewReports, validateQuery(agentPeriodQuerySchema), asyncHandler(agentsController.reconciliation));
agentsRouter.get(
  "/reconciliation/export",
  canViewReports,
  validateQuery(agentPeriodQuerySchema),
  asyncHandler(agentsController.exportReconciliation),
);

// Managing agents and paying them out is staff-only.
agentsRouter.use(requireRole("OWNER", "MANAGER"));

agentsRouter.get("/", asyncHandler(agentsController.list));
agentsRouter.get("/export", asyncHandler(agentsController.exportAgents));
agentsRouter.get("/import-template", asyncHandler(agentsController.importTemplate));
agentsRouter.post("/import", uploadSpreadsheet, asyncHandler(agentsController.importAgents));
agentsRouter.post("/", validateBody(createAgentSchema), asyncHandler(agentsController.create));
agentsRouter.patch("/bulk-bonus", validateBody(bulkBonusSchema), asyncHandler(agentsController.bulkBonus));
agentsRouter.patch("/:id", validateBody(updateAgentSchema), asyncHandler(agentsController.update));
agentsRouter.delete("/:id", asyncHandler(agentsController.remove));
agentsRouter.get("/:id/unpaid-orders", asyncHandler(agentsController.unpaidOrders));
agentsRouter.post("/:id/payouts", validateBody(createPayoutSchema), asyncHandler(agentsController.createPayout));
