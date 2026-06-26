import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import * as financeApi from "../../api/finance";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Table, Thead, Tbody, Th, Td } from "../../components/ui/Table";
import { StatCard } from "../../components/ui/StatCard";

type Tab = "analytics" | "pnl";
type Granularity = "day" | "week" | "month";

function toDateInputValue(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function defaultFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return toDateInputValue(d);
}

function defaultTo(): string {
  return toDateInputValue(new Date());
}

function rangeToIso(from: string, to: string) {
  return {
    fromIso: new Date(`${from}T00:00:00`).toISOString(),
    toIso: new Date(`${to}T23:59:59`).toISOString(),
  };
}

export function ReportsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("analytics");
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(defaultTo());
  const [granularity, setGranularity] = useState<Granularity>("day");

  function tabClass(active: boolean): string {
    return `rounded-md px-3 py-2 text-sm font-medium ${active ? "bg-brand-50 text-brand-700" : "text-gray-600 hover:bg-gray-100"}`;
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-gray-900">{t("reports.title")}</h1>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-gray-500">{t("reports.from")}</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">{t("reports.to")}</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        {tab === "analytics" && (
          <div>
            <label className="mb-1 block text-xs text-gray-500">{t("reports.granularity")}</label>
            <Select value={granularity} onChange={(e) => setGranularity(e.target.value as Granularity)}>
              <option value="day">{t("reports.granularityDay")}</option>
              <option value="week">{t("reports.granularityWeek")}</option>
              <option value="month">{t("reports.granularityMonth")}</option>
            </Select>
          </div>
        )}
      </div>

      <div className="mb-4 flex gap-2 border-b border-gray-200 pb-2">
        <button className={tabClass(tab === "analytics")} onClick={() => setTab("analytics")}>
          {t("reports.analytics")}
        </button>
        <button className={tabClass(tab === "pnl")} onClick={() => setTab("pnl")}>
          {t("reports.pnl")}
        </button>
      </div>

      {tab === "pnl" ? <PnLTab from={from} to={to} /> : <AnalyticsTab from={from} to={to} granularity={granularity} />}
    </div>
  );
}

function PnLTab({ from, to }: { from: string; to: string }) {
  const { t } = useTranslation();
  const { fromIso, toIso } = rangeToIso(from, to);
  const query = useQuery({ queryKey: ["finance", "pnl", fromIso, toIso], queryFn: () => financeApi.getPnL(fromIso, toIso) });
  const data = query.data;
  if (!data) return null;

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label={t("reports.revenue")} value={data.revenue} />
        <StatCard label={t("reports.cogs")} value={data.cogs} />
        <StatCard label={t("reports.expenses")} value={data.expenses} />
        <StatCard label={t("reports.netProfit")} value={data.netProfit} highlight />
      </div>

      <h2 className="mb-3 text-lg font-semibold text-gray-900">{t("reports.marginByProduct")}</h2>
      <Table>
        <Thead>
          <tr>
            <Th>{t("products.name")}</Th>
            <Th>{t("reports.revenue")}</Th>
            <Th>{t("reports.cogs")}</Th>
            <Th>{t("reports.margin")}</Th>
          </tr>
        </Thead>
        <Tbody>
          {data.byProduct.map((p) => (
            <tr key={p.productId}>
              <Td>{p.productName}</Td>
              <Td>{p.revenue.toLocaleString()}</Td>
              <Td>{p.cogs.toLocaleString()}</Td>
              <Td>{p.margin}%</Td>
            </tr>
          ))}
          {data.byProduct.length === 0 && (
            <tr>
              <Td colSpan={4} className="text-center text-gray-400">
                {t("common.noData")}
              </Td>
            </tr>
          )}
        </Tbody>
      </Table>
    </div>
  );
}

function AnalyticsTab({ from, to, granularity }: { from: string; to: string; granularity: Granularity }) {
  const { t } = useTranslation();
  const { fromIso, toIso } = rangeToIso(from, to);
  const query = useQuery({
    queryKey: ["finance", "analytics", fromIso, toIso, granularity],
    queryFn: () => financeApi.getAnalytics(fromIso, toIso, granularity),
  });
  const data = query.data;
  if (!data) return null;

  return (
    <div>
      <div className="mb-6 grid grid-cols-3 gap-4 sm:grid-cols-5">
        <StatCard label={t("reports.revenue")} value={data.revenue} />
        <StatCard label={t("reports.orderCount")} value={data.orderCount} isCount />
        <StatCard label={t("reports.averageOrderValue")} value={data.averageOrderValue} />
        <StatCard label={t("reports.visits")} value={data.visits} isCount />
        <StatCard label={t("reports.conversionRate")} value={data.conversionRate} isCount suffix="%" />
      </div>

      <h2 className="mb-3 text-lg font-semibold text-gray-900">{t("reports.salesOverTime")}</h2>
      <div className="mb-6 h-64 rounded-xl border border-gray-200 bg-white p-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.salesOverTime}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="revenue" fill="#1f7a64" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <h2 className="mb-3 text-lg font-semibold text-gray-900">{t("reports.topProducts")}</h2>
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
        </Tbody>
      </Table>
    </div>
  );
}
