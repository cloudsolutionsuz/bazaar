import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import * as billingController from "./billing.controller";

export const billingRouter = Router();

// Provider webhooks are called by Payme/Click's servers, not our logged-in
// users - mounted before requireAuth below.
billingRouter.post("/webhooks/payme", asyncHandler(billingController.paymeWebhook));
billingRouter.post("/webhooks/click", asyncHandler(billingController.clickWebhook));

// allowBlocked: paying the overdue invoice is exactly how a BLOCKED tenant
// gets unblocked - it can't itself require not being blocked.
billingRouter.use(requireAuth({ allowBlocked: true }));

billingRouter.get("/summary", requireRole("OWNER", "MANAGER"), asyncHandler(billingController.getSummary));
billingRouter.post("/invoices/:id/checkout", requireRole("OWNER", "MANAGER"), asyncHandler(billingController.createCheckout));
billingRouter.post(
  "/invoices/:id/confirm-sandbox-payment",
  requireRole("OWNER", "MANAGER"),
  asyncHandler(billingController.confirmSandboxPayment),
);
billingRouter.post("/run-cycle", requireRole("SUPER_ADMIN"), asyncHandler(billingController.runCycle));
