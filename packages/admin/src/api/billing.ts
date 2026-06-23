import { apiRequest } from "./client";
import type { BillingInvoice, BillingSummary } from "../types/api";

export function getBillingSummary(): Promise<BillingSummary> {
  return apiRequest("/api/billing/summary");
}

export function createCheckout(invoiceId: string): Promise<{ checkoutUrl: string; invoice: BillingInvoice }> {
  return apiRequest(`/api/billing/invoices/${invoiceId}/checkout`, { method: "POST" });
}

export function confirmSandboxPayment(invoiceId: string): Promise<{ invoice: BillingInvoice }> {
  return apiRequest(`/api/billing/invoices/${invoiceId}/confirm-sandbox-payment`, { method: "POST" });
}
