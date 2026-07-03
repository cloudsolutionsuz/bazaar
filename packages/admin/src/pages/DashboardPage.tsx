import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import * as dashboardApi from "../api/dashboard";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { StatCard } from "../components/ui/StatCard";
import { Table, Thead, Tbody, Th, Td } from "../components/ui/Table";
import { Badge } from "../components/ui/Badge";
import { STATUS_COLORS, STATUS_LABEL_KEYS } from "./orders/OrdersListPage";

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateStr(d);
}

export function DashboardPage() {
  const { t } = useTranslation();
  const today = toDateStr(new Date());
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(today);

  function applyPreset(days: number) {
    setFrom(days === 0 ? today : daysAgo(days));
    setTo(today);
  }

  const query = useQuery({
    queryKey: ["dashboard", "summary", from, to],
    queryFn: () => dashboardApi.getSummary(`${from}T00:00:00.000Z`, `${to}T23:59:59.999Z`),
  });
  const data = query.data;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <h1 className="text-xl font-semibold text-gray-900">{t("dashboard.title")}</h1>
        <div className="ml-auto flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs text-gray-500">{t("reports.from")}</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">{t("reports.to")}</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button variant="secondary" onClick={() => applyPreset(0)}>{t("reports.presetToday")}</Button>
          <Button variant="secondary" onClick={() => applyPreset(7)}>{t("reports.preset7Days")}</Button>
          <Button variant="secondary" onClick={() => applyPreset(30)}>{t("reports.preset30Days")}</Button>
        </div>
      </div>

      {data && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
            <StatCard label={t("dashboard.revenueToday")} value={data.today.revenue} />
            <StatCard label={t("dashboard.ordersToday")} value={data.today.orderCount} isCount />
            <StatCard label={t("dashboard.revenueWeek")} value={data.week.revenue} />
            <StatCard label={t("dashboard.ordersWeek")} value={data.week.orderCount} isCount />
            <Link to="/kassa">
              <StatCard label={t("dashboard.kassaBalance")} value={data.kassaBalance} highlight />
            </Link>
          </div>

          {data.lowStockCount > 0 && (
            <Link
              to="/inventory"
              className="mb-3 block rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm font-medium text-yellow-800 hover:bg-yellow-100"
            >
              {t("dashboard.lowStockWarning", { count: data.lowStockCount })} →
            </Link>
          )}

          {data.unreadChatCount > 0 && (
            <Link
              to="/chat"
              className="mb-6 block rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-medium text-blue-800 hover:bg-blue-100"
            >
              {t("dashboard.unreadChatsWarning", { count: data.unreadChatCount })} →
            </Link>
          )}

          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            {t("dashboard.salesOverTime")} ({from} — {to})
          </h2>
          <div className="mb-6 h-64 rounded-xl border border-gray-200 bg-white p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.salesOverTime}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="revenue" name={t("reports.revenue")} fill="#1f7a64" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <h2 className="mb-3 text-lg font-semibold text-gray-900">{t("dashboard.topProducts")}</h2>
          <Table>
            <Thead>
              <tr>
                <Th>{t("products.name")}</Th>
                <Th>{t("inventory.quantity")}</Th>
                <Th>{t("reports.revenue")}</Th>
              </tr>
            </Thead>
            <Tbody>
              {data.topProducts.map((p) => (
                <tr key={p.productId}>
                  <Td>{p.productName}</Td>
                  <Td>{p.quantity}</Td>
                  <Td>{p.revenue.toLocaleString()}</Td>
                </tr>
              ))}
              {data.topProducts.length === 0 && (
                <tr>
                  <Td colSpan={3} className="text-center text-gray-400">
                    {t("common.noData")}
                  </Td>
                </tr>
              )}
              {data.topProducts.length > 0 && (
                <tr className="border-t-2 border-gray-200 font-semibold">
                  <Td>{t("common.total")}</Td>
                  <Td>{data.topProducts.reduce((s, p) => s + p.quantity, 0)}</Td>
                  <Td>{data.topProducts.reduce((s, p) => s + p.revenue, 0).toLocaleString()}</Td>
                </tr>
              )}
            </Tbody>
          </Table>

          <div className="mb-3 mt-6 flex items-center justify-between">
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
              {data.recentOrders.length > 0 && (
                <tr className="border-t-2 border-gray-200 font-semibold">
                  <Td colSpan={3}>{t("common.total")}</Td>
                  <Td>{data.recentOrders.reduce((s, o) => s + o.totalAmount, 0).toLocaleString()}</Td>
                </tr>
              )}
            </Tbody>
          </Table>
        </>
      )}
    </div>
  );
}
