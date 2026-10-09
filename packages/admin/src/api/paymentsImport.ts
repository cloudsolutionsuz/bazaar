import { apiRequest } from "./client";

export type PaymentRowError =
  | "MISSING_IDENTIFIER"
  | "INVALID_PHONE"
  | "INVALID_ORDER_REF"
  | "INVALID_AMOUNT"
  | "ORDER_NOT_FOUND"
  | "ORDER_AMBIGUOUS"
  | "ORDER_CLOSED"
  | "PHONE_MISMATCH"
  | "CUSTOMER_NOT_FOUND"
  | "NO_DEBT"
  | "OVERPAID";

// What the admin types (or the spreadsheet holds) for one payment.
export interface PaymentRowInput {
  phone: string;
  orderRef: string;
  amount: number | null;
  description: string;
}

// The same row after the server matched it against orders and debts.
export interface PaymentRowPreview extends PaymentRowInput {
  status: "ok" | "error";
  errorCode: PaymentRowError | null;
  customerName: string | null;
  customerPhone: string | null;
  orderIds: string[];
  debtBefore: number | null;
  debtAfter: number | null;
}

export interface PaymentsPreview {
  rows: PaymentRowPreview[];
  errorCount: number;
}

export function downloadTemplate(): Promise<Blob> {
  return apiRequest("/api/finance/payments-import/template", { responseType: "blob" });
}

export function parseFile(file: File): Promise<PaymentsPreview> {
  const form = new FormData();
  form.append("file", file);
  return apiRequest("/api/finance/payments-import/parse", { method: "POST", body: form });
}

export function validateRows(rows: PaymentRowInput[]): Promise<PaymentsPreview> {
  return apiRequest("/api/finance/payments-import/validate", { method: "POST", body: { rows } });
}

export function commitRows(rows: PaymentRowInput[], cashRegisterId: string): Promise<{ imported: number; totalAmount: number }> {
  return apiRequest("/api/finance/payments-import/commit", { method: "POST", body: { rows, cashRegisterId } });
}
