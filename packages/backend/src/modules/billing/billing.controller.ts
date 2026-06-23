import type { Request, Response } from "express";
import * as billingService from "./billing.service";

export async function getSummary(req: Request, res: Response): Promise<void> {
  const summary = await billingService.getBillingSummary(req.authUser!.tenantId!);
  res.json(summary);
}

export async function runCycle(_req: Request, res: Response): Promise<void> {
  await billingService.runBillingCycle();
  res.json({ ok: true });
}

export async function createCheckout(req: Request, res: Response): Promise<void> {
  const invoice = await billingService.getInvoiceForTenant(req.authUser!.tenantId!, req.params.id);
  // Sandbox: no real Payme/Click merchant configured yet - point to the
  // in-admin mock checkout page instead of a real provider redirect.
  res.json({ checkoutUrl: `/billing/checkout/${invoice.id}`, invoice });
}

export async function confirmSandboxPayment(req: Request, res: Response): Promise<void> {
  await billingService.getInvoiceForTenant(req.authUser!.tenantId!, req.params.id);
  const invoice = await billingService.payInvoice(req.params.id, "MANUAL");
  res.json({ invoice });
}

export async function paymeWebhook(_req: Request, res: Response): Promise<void> {
  // TODO: once real merchant credentials exist, verify the request via Basic
  // Auth against PAYME_SECRET_KEY and dispatch on the JSON-RPC `method`
  // field (CheckPerformTransaction/CreateTransaction/PerformTransaction/...).
  // Structural stub only - not reachable without real credentials.
  res.status(503).json({ error: { code: -32504, message: "Payme is not configured" } });
}

export async function clickWebhook(_req: Request, res: Response): Promise<void> {
  // TODO: once real merchant credentials exist, verify sign_string against
  // CLICK_SECRET_KEY and dispatch on the Prepare/Complete action.
  res.status(503).json({ error: -1, error_note: "Click is not configured" });
}
