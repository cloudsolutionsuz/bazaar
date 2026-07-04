import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as platformApi from "../../api/platform";
import * as plansApi from "../../api/plans";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Badge } from "../../components/ui/Badge";
import { Table, Thead, Tbody, Th, Td } from "../../components/ui/Table";
import type { InvoiceStatus, TenantStatus } from "../../types/api";

function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateInputValue(d);
}

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

  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(toDateInputValue(new Date()));

  const tenantQuery = useQuery({ queryKey: ["platform", "tenant", id], queryFn: () => platformApi.getTenant(id as string) });
  const plansQuery = useQuery({ queryKey: ["plans"], queryFn: plansApi.listPlans });
  const productsQuery = useQuery({
    queryKey: ["platform", "tenant", id, "products-report", from, to],
    queryFn: () => platformApi.getTenantProductsReport(id as string, from, to),
  });
  const paymentsQuery = useQuery({
    queryKey: ["platform", "tenant", id, "payments-report", from, to],
    queryFn: () => platformApi.getTenantPaymentsReport(id as string, from, to),
  });

  function applyPreset(days: number): void {
    const t2 = toDateInputValue(new Date());
    if (days === 1) { setFrom(daysAgo(1)); setTo(daysAgo(1)); }
    else { setFrom(daysAgo(days)); setTo(t2); }
  }

  const changePlanMutation = useMutation({
    mutationFn: (planId: string) => platformApi.updateTenantPlan(id as string, planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform", "tenant", id] });
      queryClient.invalidateQueries({ queryKey: ["platform", "tenants"] });
      setSelectedPlanId(null);
    },
  });

  const vipMutation = useMutation({
    mutationFn: (isVip: boolean) => platformApi.updateTenantVip(id as string, isVip),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform", "tenant", id] });
      queryClient.invalidateQueries({ queryKey: ["platform", "tenants"] });
    },
  });

  const tenant = tenantQuery.data?.tenant;
  const plans = plansQuery.data?.plans ?? [];
  if (!tenant) return null;

  const owner = tenant.users.find((u) => u.role === "OWNER");

  return (
    <div>
      <Link to="/platform/tenants" className="mb-4 inline-block text-sm text-brand-600 hover:underline">
        ← {t("common.back")}
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
          {tenant.name}
          {tenant.isVip && <Badge color="yellow">{t("platform.vipBadge")}</Badge>}
        </h1>
        <div className="flex items-center gap-3">
          <Badge color={TENANT_STATUS_COLORS[tenant.status]}>{t(TENANT_STATUS_KEYS[tenant.status])}</Badge>
          <Button
            variant="secondary"
            disabled={vipMutation.isPending}
            onClick={() => {
              const confirmKey = tenant.isVip ? "platform.confirmRemoveVip" : "platform.confirmVip";
              if (window.confirm(t(confirmKey))) vipMutation.mutate(!tenant.isVip);
            }}
          >
            {t(tenant.isVip ? "platform.removeVip" : "platform.makeVip")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Sidebar */}
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm">
            <h2 className="mb-4 font-semibold text-gray-900">{t("platform.owner")}</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-gray-500">{t("platform.subdomain")}</dt>
                <dd className="font-medium">{tenant.subdomain}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">{t("platform.registeredAt")}</dt>
                <dd>{new Date(tenant.createdAt).toLocaleDateString()}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">{t("platform.owner")}</dt>
                <dd>{owner ? `${owner.name}` : "—"}</dd>
                {owner && <dd className="text-xs text-gray-500">{owner.email}</dd>}
              </div>
              <div>
                <dt className="text-xs text-gray-500">{t("billing.currentPlan")}</dt>
                <dd>{tenant.plan.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">{t("platform.ltv")}</dt>
                <dd className="font-semibold text-green-700">{tenant.ltv.toLocaleString()}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-3 font-semibold text-gray-900">{t("platform.changePlan")}</h2>
            <div className="flex flex-col gap-2">
              <Select value={selectedPlanId ?? tenant.planId} onChange={(e) => setSelectedPlanId(e.target.value)} className="w-full">
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
          </div>

          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="font-semibold text-gray-900">{t("employees.title")}</h2>
            </div>
            <Table>
              <Thead>
                <tr>
                  <Th>{t("employees.name")}</Th>
                  <Th>{t("employees.role")}</Th>
                </tr>
              </Thead>
              <Tbody>
                {tenant.users.map((user) => (
                  <tr key={user.id}>
                    <Td>
                      <div>{user.name}</div>
                      <div className="text-xs text-gray-400">{user.email}</div>
                    </Td>
                    <Td>{ROLE_KEYS[user.role] ? t(ROLE_KEYS[user.role]) : user.role}</Td>
                  </tr>
                ))}
              </Tbody>
            </Table>
          </div>
        </div>

        {/* Main content */}
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="font-semibold text-gray-900">{t("billing.history")}</h2>
            </div>
            <div className="overflow-x-auto">
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
                      <Td>{new Date(invoice.periodStart).toLocaleDateString()} — {new Date(invoice.periodEnd).toLocaleDateString()}</Td>
                      <Td>{invoice.amount.toLocaleString()}</Td>
                      <Td><Badge color={INVOICE_STATUS_COLORS[invoice.status]}>{t(INVOICE_STATUS_KEYS[invoice.status])}</Badge></Td>
                      <Td>{new Date(invoice.dueDate).toLocaleDateString()}</Td>
                      <Td>{invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString() : "—"}</Td>
                    </tr>
                  ))}
                  {tenant.invoices.length === 0 && (
                    <tr><Td colSpan={5} className="text-center text-gray-400">{t("common.noData")}</Td></tr>
                  )}
                </Tbody>
              </Table>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 font-semibold text-gray-900">{t("platform.shopReports")}</h2>
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs text-gray-500">{t("reports.from")}</label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">{t("reports.to")}</label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => applyPreset(0)}>{t("reports.presetToday")}</Button>
                <Button variant="secondary" onClick={() => applyPreset(1)}>{t("reports.presetYesterday")}</Button>
                <Button variant="secondary" onClick={() => applyPreset(7)}>{t("reports.presetWeek")}</Button>
              </div>
            </div>

            <h3 className="mb-2 text-sm font-semibold text-gray-700">{t("platform.reportProducts")}</h3>
            <div className="mb-6 overflow-x-auto">
              <Table>
                <Thead>
                  <tr>
                    <Th>{t("products.name")}</Th>
                    <Th>{t("products.category")}</Th>
                    <Th>{t("products.brand")}</Th>
                    <Th>{t("products.price")}</Th>
                    <Th>{t("products.discount")}</Th>
                    <Th>{t("reports.productQtySold")}</Th>
                    <Th>{t("reports.productRevenuePerUnit")}</Th>
                    <Th>{t("reports.margin")}</Th>
                    <Th>{t("reports.revenue")}</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {(productsQuery.data?.products ?? []).map((row) => (
                    <tr key={row.productId}>
                      <Td>{row.name}</Td>
                      <Td>{row.categoryName ?? "—"}</Td>
                      <Td>{row.brand ?? "—"}</Td>
                      <Td>{row.price.toLocaleString()}</Td>
                      <Td>{row.avgDiscountPercent}%</Td>
                      <Td>{row.quantity}</Td>
                      <Td>{row.revenuePerUnit.toLocaleString()}</Td>
                      <Td>{row.marginPercent}%</Td>
                      <Td>{row.totalRevenue.toLocaleString()}</Td>
                    </tr>
                  ))}
                  {(productsQuery.data?.products ?? []).length === 0 && (
                    <tr><Td colSpan={9} className="text-center text-gray-400">{t("common.noData")}</Td></tr>
                  )}
                </Tbody>
              </Table>
            </div>

            <h3 className="mb-2 text-sm font-semibold text-gray-700">{t("platform.reportPayments")}</h3>
            <div className="overflow-x-auto">
              <Table>
                <Thead>
                  <tr>
                    <Th>{t("customers.name")}</Th>
                    <Th>{t("customers.phone")}</Th>
                    <Th>{t("reports.paymentStatus")}</Th>
                    <Th>{t("reports.orderCount")}</Th>
                    <Th>{t("reports.paymentDebt")}</Th>
                    <Th>{t("reports.paymentPaid")}</Th>
                    <Th>{t("reports.paymentBalance")}</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {(paymentsQuery.data?.items ?? []).map((row) => (
                    <tr key={row.id}>
                      <Td>{row.name}</Td>
                      <Td>{row.phone}</Td>
                      <Td>
                        <Badge color={row.status === "paid" ? "green" : row.status === "partial" ? "yellow" : "red"}>
                          {t(`reports.paymentStatus${row.status.charAt(0).toUpperCase() + row.status.slice(1)}`)}
                        </Badge>
                      </Td>
                      <Td>{row.orderCount}</Td>
                      <Td>{row.purchaseAmount.toLocaleString()}</Td>
                      <Td>{row.paidAmount.toLocaleString()}</Td>
                      <Td>{row.balance.toLocaleString()}</Td>
                    </tr>
                  ))}
                  {(paymentsQuery.data?.items ?? []).length === 0 && (
                    <tr><Td colSpan={7} className="text-center text-gray-400">{t("common.noData")}</Td></tr>
                  )}
                </Tbody>
              </Table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
