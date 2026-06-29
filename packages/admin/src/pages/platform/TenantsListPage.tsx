import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import * as platformApi from "../../api/platform";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Table, Thead, Tbody, Th, Td } from "../../components/ui/Table";
import type { TenantStatus } from "../../types/api";

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

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-xl font-semibold text-gray-900">{value}</div>
    </div>
  );
}

export function TenantsListPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<TenantStatus | "">("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const statsQuery = useQuery({ queryKey: ["platform", "stats"], queryFn: platformApi.getStats });
  const tenantsQuery = useQuery({
    queryKey: ["platform", "tenants", { status, search, page }],
    queryFn: () => platformApi.listTenants({ status: status || undefined, search: search || undefined, page, pageSize: 20 }),
  });

  const stats = statsQuery.data;
  const tenants = tenantsQuery.data?.items ?? [];
  const total = tenantsQuery.data?.total ?? 0;
  const pageSize = tenantsQuery.data?.pageSize ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-gray-900">{t("platform.tenantsTitle")}</h1>

      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-6">
          <StatCard label={t("platform.totalTenants")} value={stats.totalTenants} />
          <StatCard label={t("billing.statusTrial")} value={stats.byStatus.TRIAL} />
          <StatCard label={t("billing.statusActive")} value={stats.byStatus.ACTIVE} />
          <StatCard label={t("billing.statusBlocked")} value={stats.byStatus.BLOCKED} />
          <StatCard label={t("platform.mrr")} value={stats.mrr.toLocaleString()} />
          <StatCard label={t("platform.totalLtv")} value={stats.totalLtv.toLocaleString()} />
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-gray-500">{t("common.status")}</label>
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as TenantStatus | "");
              setPage(1);
            }}
          >
            <option value="">{t("common.all")}</option>
            {Object.entries(TENANT_STATUS_KEYS).map(([value, key]) => (
              <option key={value} value={value}>
                {t(key)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">{t("common.search")}</label>
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t("platform.searchPlaceholder")}
          />
        </div>
      </div>

      <Table>
        <Thead>
          <tr>
            <Th>{t("platform.shopName")}</Th>
            <Th>{t("platform.subdomain")}</Th>
            <Th>{t("common.status")}</Th>
            <Th>{t("billing.currentPlan")}</Th>
            <Th>{t("platform.owner")}</Th>
            <Th>{t("platform.ltv")}</Th>
            <Th>{t("platform.registeredAt")}</Th>
          </tr>
        </Thead>
        <Tbody>
          {tenants.map((tenant) => (
            <tr key={tenant.id}>
              <Td>
                <span className="flex items-center gap-2">
                  <Link to={`/platform/tenants/${tenant.id}`} className="text-brand-600 hover:underline">
                    {tenant.name}
                  </Link>
                  {tenant.isVip && <Badge color="yellow">{t("platform.vipBadge")}</Badge>}
                </span>
              </Td>
              <Td>{tenant.subdomain}</Td>
              <Td>
                <Badge color={TENANT_STATUS_COLORS[tenant.status]}>{t(TENANT_STATUS_KEYS[tenant.status])}</Badge>
              </Td>
              <Td>{tenant.plan.name}</Td>
              <Td>{tenant.users[0]?.email ?? "—"}</Td>
              <Td>{tenant.ltv.toLocaleString()}</Td>
              <Td>{new Date(tenant.createdAt).toLocaleDateString()}</Td>
            </tr>
          ))}
          {tenants.length === 0 && (
            <tr>
              <Td colSpan={7} className="text-center text-gray-400">
                {t("common.noData")}
              </Td>
            </tr>
          )}
        </Tbody>
      </Table>

      <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
        <span>
          {t("common.page")} {page} / {totalPages}
        </span>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ←
          </Button>
          <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            →
          </Button>
        </div>
      </div>
    </div>
  );
}
