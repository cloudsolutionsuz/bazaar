import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { validateBody, validateQuery } from "../../middleware/validate";
import { uploadSpreadsheet } from "../../middleware/upload";
import {
  analyticsQuerySchema,
  balanceQuerySchema,
  commitPaymentsImportSchema,
  confirmTransactionSchema,
  createTransactionSchema,
  dailySummaryQuerySchema,
  forecastQuerySchema,
  listPendingTransactionsQuerySchema,
  listTransactionsQuerySchema,
  reportQuerySchema,
  validatePaymentsImportSchema,
} from "./finance.schema";
import * as financeController from "./finance.controller";

export const financeRouter = Router();

financeRouter.use(requireAuth(), requireRole("OWNER", "MANAGER"));

financeRouter.get("/balance", validateQuery(balanceQuerySchema), asyncHandler(financeController.getBalance));
financeRouter.get("/daily-summary", validateQuery(dailySummaryQuerySchema), asyncHandler(financeController.getDailySummary));
financeRouter.get(
  "/transactions/pending",
  validateQuery(listPendingTransactionsQuerySchema),
  asyncHandler(financeController.listPendingTransactions),
);
financeRouter.post(
  "/transactions/:id/confirm",
  validateBody(confirmTransactionSchema),
  asyncHandler(financeController.confirmTransaction),
);
financeRouter.get("/transactions", validateQuery(listTransactionsQuerySchema), asyncHandler(financeController.listTransactions));
financeRouter.post("/transactions", validateBody(createTransactionSchema), asyncHandler(financeController.createTransaction));
financeRouter.get("/payments-import/template", asyncHandler(financeController.paymentsImportTemplate));
financeRouter.post("/payments-import/parse", uploadSpreadsheet, asyncHandler(financeController.parsePaymentsImport));
financeRouter.post(
  "/payments-import/validate",
  validateBody(validatePaymentsImportSchema),
  asyncHandler(financeController.validatePaymentsImport),
);
financeRouter.post(
  "/payments-import/commit",
  validateBody(commitPaymentsImportSchema),
  asyncHandler(financeController.commitPaymentsImport),
);
financeRouter.get("/pnl", validateQuery(reportQuerySchema), asyncHandler(financeController.getPnL));
financeRouter.get("/pnl/export", validateQuery(reportQuerySchema), asyncHandler(financeController.exportPnL));
financeRouter.get("/analytics", validateQuery(analyticsQuerySchema), asyncHandler(financeController.getAnalytics));
financeRouter.get("/analytics/export", validateQuery(analyticsQuerySchema), asyncHandler(financeController.exportAnalytics));
financeRouter.get("/forecast", validateQuery(forecastQuerySchema), asyncHandler(financeController.getForecast));
financeRouter.get("/reports/products", validateQuery(reportQuerySchema), asyncHandler(financeController.getProductSalesReport));
