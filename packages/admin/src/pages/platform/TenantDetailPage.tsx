import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as platformApi from "../../api/platform";
import * as plansApi from "../../api/plans";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { Badge } from "../../components/ui/Badge";
import { Table, Thead, Tbody, Th, Td } from "../../components/ui/Table";
import type { InvoiceStatus, TenantStatus } from "../../types/api";

const TENANT_STATUS_COLORS: Record<TenantStatus, "green" | "blue" | "yellow" | "red"> = {
  TRIAL: "blue",
  ACTIVE: "green",
  PAST_DUE: "yellow",
  BLOCKED: "red",
};

const TENANT_STATUS_KEYS: Record<TenantStatus, string> = {
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

const ROLE_KEYS: Record<string, string> = {
  OWNER: "employees.roleOwner",
  MANAGER: "employees.roleManager",
  CASHIER: "employees.roleCashier",
};

export function TenantDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const tenantQuery = useQuery({ queryKey: ["platform", "tenant", id], queryFn: () => platformApi.getTenant(id as string) });
  const plansQuery = useQuery({ queryKey: ["plans"], queryFn: plansApi.listPlans });

  const changePlanMutation = useMutation({
    mutationFn: (planId: string) => platformApi.updateTenantPlan(id as string, planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform", "tenant", id] });
      queryClient.invalidateQueries({ queryKey: ["platform", "tenants"] });
      setSelectedPlanId(null);
    },
  });

  const tenant = tenantQuery.data?.tenant;
  const plans = plansQuery.data?.plans ?? [];
  if (!tenant) return null;

  const owner = tenant.users.find((u) => u.role === "OWNER");

  return (
    <div className="max-w-3xl">
      <Link to="/platform/tenants" className="mb-4 inline-block text-sm text-brand-600 hover:underline">
        ← {t("common.back")}
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">{tenant.name}</h1>
        <Badge color={TENANT_STATUS_COLORS[tenant.status]}>{t(TENANT_STATUS_KEYS[tenant.status])}</Badge>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 rounded-xl border border-gray-200 bg-white p-6 text-sm">
        <div>
          <div className="text-gray-500">{t("platform.subdomain")}</div>
          <div>{tenant.subdomain}</div>
        </div>
        <div>
          <div className="text-gray-500">{t("platform.registeredAt")}</div>
          <div>{new Date(tenant.createdAt).toLocaleDateString()}</div>
        </div>
        <div>
          <div className="text-gray-500">{t("platform.owner")}</div>
          <div>{owner ? `${owner.name} (${owner.email})` : "—"}</div>
        </div>
        <div>
          <div className="text-gray-500">{t("billing.currentPlan")}</div>
          <div>{tenant.plan.name}</div>
        </div>
      </div>

      <section className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">{t("platform.changePlan")}</h2>
        <div className="flex items-end gap-2">
          <Select value={selectedPlanId ?? tenant.planId} onChange={(e) => setSelectedPlanId(e.target.value)}>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} — {plan.priceSum.toLocaleString()}
              </option>
            ))}
          </Select>
          <Button
            disabled={!selectedPlanId || selectedPlanId === tenant.planId || changePlanMutation.isPending}
            onClick={() => selectedPlanId && changePlanMutation.mutate(selectedPlanId)}
          >
            {t("common.save")}
          </Button>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">{t("employees.title")}</h2>
        <Table>
          <Thead>
            <tr>
              <Th>{t("employees.name")}</Th>
              <Th>{t("employees.email")}</Th>
              <Th>{t("employees.role")}</Th>
            </tr>
          </Thead>
          <Tbody>
            {tenant.users.map((user) => (
              <tr key={user.id}>
                <Td>{user.name}</Td>
                <Td>{user.email}</Td>
                <Td>{ROLE_KEYS[user.role] ? t(ROLE_KEYS[user.role]) : user.role}</Td>
              </tr>
            ))}
          </Tbody>
        </Table>
      </section>

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
            {tenant.invoices.map((invoice) => (
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
            {tenant.invoices.length === 0 && (
              <tr>
                <Td colSpan={5} className="text-center text-gray-400">
                  {t("common.noData")}
                </Td>
              </tr>
            )}
          </Tbody>
        </Table>
      </section>
    </div>
  );
}
