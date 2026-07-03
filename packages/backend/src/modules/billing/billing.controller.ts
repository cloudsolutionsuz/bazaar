import crypto from "crypto";
import type { Request, Response } from "express";
import * as billingService from "./billing.service";
import { env } from "../../config/env";

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

  if (env.clickServiceId && env.clickMerchantId) {
    const returnUrl = encodeURIComponent(`${env.adminUrl}/billing`);
    const clickUrl =
      `https://my.click.uz/services/pay` +
      `?service_id=${env.clickServiceId}` +
      `&merchant_id=${env.clickMerchantId}` +
      `&amount=${invoice.amount}` +
      `&transaction_param=${invoice.id}` +
      `&return_url=${returnUrl}`;
    res.json({ checkoutUrl: clickUrl, invoice });
    return;
  }

  res.json({ checkoutUrl: `/billing/checkout/${invoice.id}`, invoice });
}

export async function confirmSandboxPayment(req: Request, res: Response): Promise<void> {
  await billingService.getInvoiceForTenant(req.authUser!.tenantId!, req.params.id);
  const invoice = await billingService.payInvoice(req.params.id, "MANUAL");
  res.json({ invoice });
}

export async function changePlan(req: Request, res: Response): Promise<void> {
  const { planId } = req.body as { planId: string };
  const plan = await billingService.changePlan(req.authUser!.tenantId!, planId);
  res.json({ plan });
}

export async function createPrepayInvoice(req: Request, res: Response): Promise<void> {
  const months = Number(req.body.months) as 3 | 6 | 12;
  if (![3, 6, 12].includes(months)) {
    res.status(400).json({ error: { code: "INVALID_MONTHS", message: "months must be 3, 6, or 12" } });
    return;
  }
  const result = await billingService.createPrepayInvoice(req.authUser!.tenantId!, months);
  res.status(201).json(result);
}

export async function paymeWebhook(_req: Request, res: Response): Promise<void> {
  res.status(503).json({ error: { code: -32504, message: "Payme is not configured" } });
}

// Click sends Prepare (action=0) before charging and Complete (action=1)
// after a successful charge. Both come as form-encoded POST bodies.
// Signature: MD5(click_trans_id + service_id + secret + merchant_trans_id
//            [+ merchant_prepare_id on Complete] + amount + action + sign_time)
export async function clickWebhook(req: Request, res: Response): Promise<void> {
  if (!env.clickServiceId || !env.clickSecretKey) {
    res.status(503).json({ error: -1, error_note: "Click is not configured" });
    return;
  }

  const b = req.body as Record<string, string>;
  const clickTransId = Number(b.click_trans_id);
  const invoiceId = b.merchant_trans_id;
  const action = Number(b.action);

  // Signature verification
  let signBase: string;
  if (action === 0) {
    signBase = `${b.click_trans_id}${b.service_id}${env.clickSecretKey}${invoiceId}${b.amount}${b.action}${b.sign_time}`;
  } else if (action === 1) {
    signBase = `${b.click_trans_id}${b.service_id}${env.clickSecretKey}${invoiceId}${b.merchant_prepare_id ?? ""}${b.amount}${b.action}${b.sign_time}`;
  } else {
    res.json({ click_trans_id: clickTransId, merchant_trans_id: invoiceId, error: -3, error_note: "Action not found" });
    return;
  }

  const expectedSign = crypto.createHash("md5").update(signBase).digest("hex");
  if (expectedSign !== b.sign_string) {
    res.json({ click_trans_id: clickTransId, merchant_trans_id: invoiceId, error: -1, error_note: "SIGN CHECK FAILED!" });
    return;
  }

  if (action === 0) {
    // Prepare: verify the invoice exists and is still payable
    const invoice = await billingService.getInvoiceById(invoiceId);
    if (!invoice) {
      res.json({ click_trans_id: clickTransId, merchant_trans_id: invoiceId, merchant_prepare_id: -1, error: -5, error_note: "Invoice not found" });
      return;
    }
    if (invoice.status === "PAID") {
      res.json({ click_trans_id: clickTransId, merchant_trans_id: invoiceId, merchant_prepare_id: -1, error: -4, error_note: "Already paid" });
      return;
    }
    res.json({ click_trans_id: clickTransId, merchant_trans_id: invoiceId, merchant_prepare_id: invoice.id, error: 0, error_note: "Success" });
    return;
  }

  // Complete: Click is telling us the charge succeeded (or was cancelled)
  if (Number(b.error) < 0) {
    // Click cancelled/reversed the transaction — acknowledge and do nothing
    res.json({ click_trans_id: clickTransId, merchant_trans_id: invoiceId, merchant_confirm_id: 0, error: 0, error_note: "Success" });
    return;
  }

  const invoice = await billingService.getInvoiceById(invoiceId);
  if (!invoice) {
    res.json({ click_trans_id: clickTransId, merchant_trans_id: invoiceId, merchant_confirm_id: -1, error: -6, error_note: "Transaction does not exist" });
    return;
  }
  if (invoice.status === "PAID") {
    // Idempotent — Click may retry Complete
    res.json({ click_trans_id: clickTransId, merchant_trans_id: invoiceId, merchant_confirm_id: 1, error: 0, error_note: "Success" });
    return;
  }

  await billingService.payInvoice(invoiceId, "CLICK", String(clickTransId));
  res.json({ click_trans_id: clickTransId, merchant_trans_id: invoiceId, merchant_confirm_id: 1, error: 0, error_note: "Success" });
}
