import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { validateBody, validateQuery } from "../../middleware/validate";
import { analyticsQuerySchema, createTransactionSchema, listTransactionsQuerySchema, reportQuerySchema } from "./finance.schema";
import * as financeController from "./finance.controller";

export const financeRouter = Router();

financeRouter.use(requireAuth(), requireRole("OWNER", "MANAGER"));

financeRouter.get("/balance", asyncHandler(financeController.getBalance));
financeRouter.get("/transactions", validateQuery(listTransactionsQuerySchema), asyncHandler(financeController.listTransactions));
financeRouter.post("/transactions", validateBody(createTransactionSchema), asyncHandler(financeController.createTransaction));
financeRouter.get("/pnl", validateQuery(reportQuerySchema), asyncHandler(financeController.getPnL));
financeRouter.get("/analytics", validateQuery(analyticsQuerySchema), asyncHandler(financeController.getAnalytics));
