import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as billingApi from "../../api/billing";
import * as plansApi from "../../api/plans";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
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
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [planChanged, setPlanChanged] = useState(false);
  const [prepayCreated, setPrepayCreated] = useState(false);

  const summaryQuery = useQuery({ queryKey: ["billing", "summary"], queryFn: billingApi.getBillingSummary });
  const plansQuery = useQuery({ queryKey: ["plans"], queryFn: plansApi.listPlans });

  // checkoutMutation: if Click is configured, server returns a real Click URL
  // and we redirect; otherwise it returns the sandbox path and we open the modal.
  const checkoutMutation = useMutation({
    mutationFn: (invoiceId: string) => billingApi.createCheckout(invoiceId),
    onSuccess: ({ checkoutUrl }) => {
      if (checkoutUrl.startsWith("https://")) {
        window.open(checkoutUrl, "_blank", "noopener,noreferrer");
      } else {
        // Extract invoice ID from "/billing/checkout/:id" for sandbox modal
        const id = checkoutUrl.split("/").pop() ?? null;
        setPayingInvoiceId(id);
      }
    },
  });

  const payMutation = useMutation({
    mutationFn: (invoiceId: string) => billingApi.confirmSandboxPayment(invoiceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing"] });
      setPayingInvoiceId(null);
      setJustPaid(true);
      setTimeout(() => setJustPaid(false), 3000);
    },
  });

  const changePlanMutation = useMutation({
    mutationFn: (planId: string) => billingApi.changePlan(planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing"] });
      setSelectedPlanId(null);
      setPlanChanged(true);
      setTimeout(() => setPlanChanged(false), 3000);
    },
  });

  const prepayMutation = useMutation({
    mutationFn: (months: 3 | 6 | 12) => billingApi.createPrepayInvoice(months),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing"] });
      setPrepayCreated(true);
      setTimeout(() => setPrepayCreated(false), 5000);
    },
  });

  const summary = summaryQuery.data;
  const plans = plansQuery.data?.plans ?? [];
  if (!summary) return null;

  const { tenant, invoices, nextInvoice, clickConfigured } = summary;

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
        <h2 className="mb-3 text-lg font-semibold text-gray-900">{t("billing.changePlan")}</h2>
        {planChanged && <p className="mb-3 text-sm text-green-600">{t("billing.changePlanSuccess")}</p>}
        <div className="flex items-end gap-2">
          <Select value={selectedPlanId ?? tenant.planId} onChange={(e) => setSelectedPlanId(e.target.value)}>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} — {plan.priceSum.toLocaleString()} сум/мес
              </option>
            ))}
          </Select>
          <Button
            disabled={!selectedPlanId || selectedPlanId === tenant.planId || changePlanMutation.isPending}
            onClick={() => selectedPlanId && changePlanMutation.mutate(selectedPlanId)}
          >
            {t("billing.changePlanConfirm")}
          </Button>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">{t("billing.prepay")}</h2>
        <p className="mb-4 text-sm text-gray-500">{t("billing.prepayHint")}</p>
        {prepayCreated && <p className="mb-3 text-sm text-green-600">{t("billing.prepayInvoiceCreated")}</p>}
        <div className="grid grid-cols-3 gap-3">
          {([3, 6, 12] as const).map((months) => {
            const discounts: Record<number, number> = { 3: 0.05, 6: 0.10, 12: 0.15 };
            const discount = discounts[months];
            const amount = Math.round(tenant.plan.priceSum * months * (1 - discount));
            const labelKey = `billing.prepay${months}months` as const;
            return (
              <button
                key={months}
                disabled={prepayMutation.isPending}
                onClick={() => prepayMutation.mutate(months)}
                className="rounded-xl border border-gray-200 p-4 text-left hover:border-brand-400 hover:bg-brand-50 disabled:opacity-50"
              >
                <div className="mb-1 text-sm font-medium text-gray-900">{t(labelKey)}</div>
                <div className="text-sm text-brand-700">{t("billing.prepayAmount", { amount: amount.toLocaleString() })}</div>
              </button>
            );
          })}
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
            <Button
              disabled={checkoutMutation.isPending}
              onClick={() => checkoutMutation.mutate(nextInvoice.id)}
            >
              {clickConfigured ? t("billing.payViaClick") : t("billing.pay")}
            </Button>
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
