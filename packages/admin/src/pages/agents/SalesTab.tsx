import { useState } from "react";
import { useTranslation } from "react-i18next";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import * as agentsApi from "../../api/agents";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { StatCard } from "../../components/ui/StatCard";
import { Table, Thead, Tbody, Th, Td } from "../../components/ui/Table";
import { shortOrderId } from "../../utils/orderId";
import { STATUS_COLORS, STATUS_LABEL_KEYS } from "../orders/OrdersListPage";
import type { OrderStatus } from "../../types/api";

const PAGE_SIZE = 20;

interface SalesTabProps {
  period: agentsApi.AgentPeriodParams;
  status: OrderStatus | "";
  payment: agentsApi.AgentPaymentFilter | "";
  // Staff see whose sale each row is; an agent only ever sees their own.
  showAgent: boolean;
}

export function SalesTab({ period, status, payment, showAgent }: SalesTabProps) {
  const { t } = useTranslation();
  const filters = { ...period, status: status || undefined, payment: payment || undefined };
  const filterKey = JSON.stringify(filters);
  // The page number belongs to the filters it was reached under: changing
  // any filter starts again from page 1, without an extra fetch in between.
  const [paging, setPaging] = useState({ filterKey, page: 1 });
  const page = paging.filterKey === filterKey ? paging.page : 1;
  const setPage = (next: number) => setPaging({ filterKey, page: next });

  const query = useQuery({
    queryKey: ["agents", "sales", filterKey, page],
    queryFn: () => agentsApi.getSales({ ...filters, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const summary = query.data?.summary;
  const rows = query.data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / PAGE_SIZE));
  const columnCount = showAgent ? 8 : 7;

  return (
    <div>
      {query.isError && <p className="mb-3 text-sm text-red-600">{t("common.error")}</p>}

      {summary && (
        <>
          <div className="mb-3 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard label={t("agentSales.statOrders")} value={summary.totalCount} isCount />
            <StatCard label={t("agentSales.statOrdersAmount")} value={summary.totalAmount} />
            <StatCard label={t("agentSales.statArchived")} value={summary.archivedCount} isCount />
            <StatCard label={t("agentSales.statBonusAccrued")} value={summary.bonusAccrued} />
            <StatCard label={t("agentSales.statPaid", { count: summary.paidCount })} value={summary.paidAmount} />
            <StatCard label={t("agentSales.statUnpaid", { count: summary.unpaidCount })} value={summary.unpaidAmount} />
          </div>
          <div className="mb-5 flex flex-wrap gap-2 text-sm">
            {summary.byStatus.map((row) => (
              <span key={row.status} className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 dark:border-gray-700 dark:bg-gray-800">
                <Badge color={STATUS_COLORS[row.status]}>{t(STATUS_LABEL_KEYS[row.status])}</Badge>
                <span className="font-medium text-gray-900 dark:text-gray-100">{row.count}</span>
                <span className="text-gray-500">· {row.amount.toLocaleString()}</span>
              </span>
            ))}
          </div>
        </>
      )}

      <Table>
        <Thead>
          <tr>
            <Th>{t("orders.id")}</Th>
            <Th>{t("orders.date")}</Th>
            {showAgent && <Th>{t("agentSales.agent")}</Th>}
            <Th>{t("orders.customer")}</Th>
            <Th>{t("common.status")}</Th>
            <Th>{t("orders.total")}</Th>
            <Th>{t("agentSales.bonus")}</Th>
            <Th>{t("agentSales.payment")}</Th>
          </tr>
        </Thead>
        <Tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <Td className="whitespace-nowrap font-mono text-xs text-gray-500">{shortOrderId(row.id)}</Td>
              <Td className="whitespace-nowrap">{new Date(row.createdAt).toLocaleString()}</Td>
              {showAgent && <Td>{row.agentName ?? "—"}</Td>}
              <Td>{row.customerName}</Td>
              <Td>
                <Badge color={STATUS_COLORS[row.status]}>{t(STATUS_LABEL_KEYS[row.status])}</Badge>
              </Td>
              <Td>{row.totalAmount.toLocaleString()}</Td>
              <Td>{row.agentBonus === null ? "—" : row.agentBonus.toLocaleString()}</Td>
              <Td>
                {row.isPaid ? (
                  <Badge color="green">
                    {t("agentSales.paymentPaid")}
                    {row.paidAt ? ` · ${new Date(row.paidAt).toLocaleDateString()}` : ""}
                  </Badge>
                ) : row.agentBonus !== null && row.agentBonus > 0 ? (
                  <Badge color="yellow">{t("agentSales.paymentUnpaid")}</Badge>
                ) : (
                  "—"
                )}
              </Td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <Td colSpan={columnCount} className="text-center text-gray-400">
                {query.isLoading ? t("common.loading") : t("common.noData")}
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
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            ←
          </Button>
          <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            →
          </Button>
        </div>
      </div>
    </div>
  );
}
