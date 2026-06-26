import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import * as dashboardApi from "../api/dashboard";
import { StatCard } from "../components/ui/StatCard";
import { Table, Thead, Tbody, Th, Td } from "../components/ui/Table";
import { Badge } from "../components/ui/Badge";
import { STATUS_COLORS, STATUS_LABEL_KEYS } from "./orders/OrdersListPage";

export function DashboardPage() {
  const { t } = useTranslation();
  const query = useQuery({ queryKey: ["dashboard", "summary"], queryFn: dashboardApi.getSummary });
  const data = query.data;

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-gray-900">{t("dashboard.title")}</h1>

      {data && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label={t("dashboard.revenueToday")} value={data.today.revenue} />
            <StatCard label={t("dashboard.ordersToday")} value={data.today.orderCount} isCount />
            <StatCard label={t("dashboard.revenueWeek")} value={data.week.revenue} />
            <StatCard label={t("dashboard.ordersWeek")} value={data.week.orderCount} isCount />
          </div>

          {data.lowStockCount > 0 && (
            <Link
              to="/inventory"
              className="mb-6 block rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm font-medium text-yellow-800 hover:bg-yellow-100"
            >
              {t("dashboard.lowStockWarning", { count: data.lowStockCount })} →
            </Link>
          )}

          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">{t("dashboard.recentOrders")}</h2>
            <Link to="/orders" className="text-sm text-brand-600 hover:underline">
              {t("dashboard.allOrders")} →
            </Link>
          </div>
          <Table>
            <Thead>
              <tr>
                <Th>{t("orders.customer")}</Th>
                <Th>{t("orders.date")}</Th>
                <Th>{t("common.status")}</Th>
                <Th>{t("orders.total")}</Th>
              </tr>
            </Thead>
            <Tbody>
              {data.recentOrders.map((o) => (
                <tr key={o.id}>
                  <Td>{o.customerName}</Td>
                  <Td>{new Date(o.createdAt).toLocaleString()}</Td>
                  <Td>
                    <Badge color={STATUS_COLORS[o.status]}>{t(STATUS_LABEL_KEYS[o.status])}</Badge>
                  </Td>
                  <Td>{o.totalAmount.toLocaleString()}</Td>
                </tr>
              ))}
              {data.recentOrders.length === 0 && (
                <tr>
                  <Td colSpan={4} className="text-center text-gray-400">
                    {t("common.noData")}
                  </Td>
                </tr>
              )}
            </Tbody>
          </Table>
        </>
      )}
    </div>
  );
}
