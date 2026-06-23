import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as billingApi from "../../api/billing";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { Table, Thead, Tbody, Th, Td } from "../../components/ui/Table";
import type { InvoiceStatus } from "../../types/api";

const TENANT_STATUS_COLORS: Record<string, "green" | "blue" | "yellow" | "red"> = {
  TRIAL: "blue",
  ACTIVE: "green",
  PAST_DUE: "yellow",
  BLOCKED: "red",
};

const TENANT_STATUS_KEYS: Record<string, string> = {
  TRIAL: "billing.statusTrial",
  ACTIVE: "billing.statusActive",
  PAST_DUE: "billing.statusPastDue",
  BLOCKED: "billing.statusBlocked",
};

const INVOICE_STATUS_COLORS: Record<InvoiceStatus, "yellow" | "green" | "red" | "gray"> = {
  PENDING: "yellow",
  PAID: "green",
  OVERDUE: "red",
  CANCELLED: "gray",
};

const INVOICE_STATUS_KEYS: Record<InvoiceStatus, string> = {
  PENDING: "billing.invoiceStatusPending",
  PAID: "billing.invoiceStatusPaid",
  OVERDUE: "billing.invoiceStatusOverdue",
  CANCELLED: "billing.invoiceStatusCancelled",
};

export function BillingPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [justPaid, setJustPaid] = useState(false);

  const summaryQuery = useQuery({ queryKey: ["billing", "summary"], queryFn: billingApi.getBillingSummary });

  const payMutation = useMutation({
    mutationFn: (invoiceId: string) => billingApi.confirmSandboxPayment(invoiceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing"] });
      setPayingInvoiceId(null);
      setJustPaid(true);
      setTimeout(() => setJustPaid(false), 3000);
    },
  });

  const summary = summaryQuery.data;
  if (!summary) return null;

  const { tenant, invoices, nextInvoice } = summary;

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">{t("billing.title")}</h1>

      <div className="mb-6 grid grid-cols-2 gap-4 rounded-xl border border-gray-200 bg-white p-6">
        <div>
          <div className="text-sm text-gray-500">{t("billing.currentPlan")}</div>
          <div className="text-lg font-semibold text-gray-900">{tenant.plan.name}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">{t("billing.shopStatus")}</div>
          <Badge color={TENANT_STATUS_COLORS[tenant.status]}>{t(TENANT_STATUS_KEYS[tenant.status])}</Badge>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">{t("billing.nextCharge")}</h2>
        {justPaid && <p className="mb-3 text-sm text-green-600">{t("billing.paySuccess")}</p>}
        {nextInvoice ? (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-semibold text-gray-900">{nextInvoice.amount.toLocaleString()}</div>
              <div className="mb-1 text-sm text-gray-500">
                {t("billing.dueDate")}: {new Date(nextInvoice.dueDate).toLocaleDateString()}
              </div>
              <Badge color={INVOICE_STATUS_COLORS[nextInvoice.status]}>{t(INVOICE_STATUS_KEYS[nextInvoice.status])}</Badge>
            </div>
            <Button onClick={() => setPayingInvoiceId(nextInvoice.id)}>{t("billing.pay")}</Button>
          </div>
        ) : (
          <p className="text-sm text-gray-500">{t("billing.noNextCharge")}</p>
        )}
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">{t("billing.history")}</h2>
        <Table>
          <Thead>
            <tr>
              <Th>{t("billing.period")}</Th>
              <Th>{t("billing.amount")}</Th>
              <Th>{t("billing.status")}</Th>
              <Th>{t("billing.dueDate")}</Th>
              <Th>{t("billing.paidAt")}</Th>
            </tr>
          </Thead>
          <Tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id}>
                <Td>
                  {new Date(invoice.periodStart).toLocaleDateString()} — {new Date(invoice.periodEnd).toLocaleDateString()}
                </Td>
                <Td>{invoice.amount.toLocaleString()}</Td>
                <Td>
                  <Badge color={INVOICE_STATUS_COLORS[invoice.status]}>{t(INVOICE_STATUS_KEYS[invoice.status])}</Badge>
                </Td>
                <Td>{new Date(invoice.dueDate).toLocaleDateString()}</Td>
                <Td>{invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString() : "—"}</Td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <Td colSpan={5} className="text-center text-gray-400">
                  {t("common.noData")}
                </Td>
              </tr>
            )}
          </Tbody>
        </Table>
      </section>

      <Modal open={payingInvoiceId !== null} onClose={() => setPayingInvoiceId(null)} title={t("billing.pay")}>
        <p className="mb-4 text-sm text-amber-700">{t("billing.sandboxNotice")}</p>
        <Button disabled={payMutation.isPending} onClick={() => payingInvoiceId && payMutation.mutate(payingInvoiceId)}>
          {t("billing.payConfirm")}
        </Button>
      </Modal>
    </div>
  );
}
