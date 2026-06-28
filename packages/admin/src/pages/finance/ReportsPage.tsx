import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import * as financeApi from "../../api/finance";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Table, Thead, Tbody, Th, Td } from "../../components/ui/Table";
import { StatCard } from "../../components/ui/StatCard";
import { downloadBlob } from "../../utils/downloadBlob";

type Tab = "analytics" | "pnl" | "forecast";
type Granularity = "day" | "week" | "month";

function toDateInputValue(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toDateInputValue(d);
}

function defaultFrom(): string {
  return daysAgo(30);
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

// Same-length period immediately before the current one - not literally
// "last calendar month", since the current range can be any custom dates,
// but it degenerates to that when the user picks a calendar-month-ish range.
function previousPeriod(from: string, to: string): { from: string; to: string } {
  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T00:00:00`);
  const durationMs = toDate.getTime() - fromDate.getTime();
  const prevTo = new Date(fromDate.getTime() - 24 * 60 * 60 * 1000);
  const prevFrom = new Date(prevTo.getTime() - durationMs);
  return { from: toDateInputValue(prevFrom), to: toDateInputValue(prevTo) };
}

function percentDelta(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
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

  function applyPreset(days: number) {
    setFrom(days === 0 ? defaultTo() : daysAgo(days));
    setTo(defaultTo());
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-gray-900">{t("reports.title")}</h1>

      <div className="mb-4 flex gap-2 border-b border-gray-200 pb-2">
        <button className={tabClass(tab === "analytics")} onClick={() => setTab("analytics")}>
          {t("reports.analytics")}
        </button>
        <button className={tabClass(tab === "pnl")} onClick={() => setTab("pnl")}>
          {t("reports.pnl")}
        </button>
        <button className={tabClass(tab === "forecast")} onClick={() => setTab("forecast")}>
          {t("reports.forecast")}
        </button>
      </div>

      {tab !== "forecast" && (
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
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => applyPreset(0)}>
              {t("reports.presetToday")}
            </Button>
            <Button variant="secondary" onClick={() => applyPreset(7)}>
              {t("reports.preset7Days")}
            </Button>
            <Button variant="secondary" onClick={() => applyPreset(30)}>
              {t("reports.preset30Days")}
            </Button>
            <Button variant="secondary" onClick={() => applyPreset(90)}>
              {t("reports.preset90Days")}
            </Button>
          </div>
        </div>
      )}

      {tab === "pnl" && <PnLTab from={from} to={to} />}
      {tab === "analytics" && <AnalyticsTab from={from} to={to} granularity={granularity} />}
      {tab === "forecast" && <ForecastTab />}
    </div>
  );
}

function PnLTab({ from, to }: { from: string; to: string }) {
  const { t } = useTranslation();
  const { fromIso, toIso } = rangeToIso(from, to);
  const query = useQuery({ queryKey: ["finance", "pnl", fromIso, toIso], queryFn: () => financeApi.getPnL(fromIso, toIso) });
  const data = query.data;

  const previous = previousPeriod(from, to);
  const { fromIso: prevFromIso, toIso: prevToIso } = rangeToIso(previous.from, previous.to);
  const previousQuery = useQuery({
    queryKey: ["finance", "pnl", prevFromIso, prevToIso],
    queryFn: () => financeApi.getPnL(prevFromIso, prevToIso),
  });
  const previousData = previousQuery.data;

  async function handleExport() {
    const blob = await financeApi.exportPnL(fromIso, toIso);
    downloadBlob(blob, "pnl.xlsx");
  }

  if (!data) return null;

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button variant="secondary" onClick={handleExport}>
          {t("common.export")}
        </Button>
      </div>

      {previousData && (
        <p className="mb-2 text-xs text-gray-400">
          {t("reports.comparedToPrevious", { from: previous.from, to: previous.to })}
        </p>
      )}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label={t("reports.revenue")}
          value={data.revenue}
          delta={previousData ? percentDelta(data.revenue, previousData.revenue) : undefined}
        />
        <StatCard
          label={t("reports.cogs")}
          value={data.cogs}
          delta={previousData ? percentDelta(data.cogs, previousData.cogs) : undefined}
          lowerIsBetter
        />
        <StatCard
          label={t("reports.expenses")}
          value={data.expenses}
          delta={previousData ? percentDelta(data.expenses, previousData.expenses) : undefined}
          lowerIsBetter
        />
        <StatCard
          label={t("reports.netProfit")}
          value={data.netProfit}
          highlight
          delta={previousData ? percentDelta(data.netProfit, previousData.netProfit) : undefined}
        />
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

  async function handleExport() {
    const blob = await financeApi.exportAnalytics(fromIso, toIso, granularity);
    downloadBlob(blob, "analytics.xlsx");
  }

  if (!data) return null;

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button variant="secondary" onClick={handleExport}>
          {t("common.export")}
        </Button>
      </div>

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

function ForecastTab() {
  const { t } = useTranslation();
  const [horizonDays, setHorizonDays] = useState<30 | 60>(30);

  const query = useQuery({
    queryKey: ["finance", "forecast", horizonDays],
    queryFn: () => financeApi.getForecast(horizonDays),
  });
  const data = query.data;
  if (!data) return null;

  const trendKey = data.slopePerDay > 0 ? "reports.trendUp" : data.slopePerDay < 0 ? "reports.trendDown" : "reports.trendFlat";

  const chartData = [
    ...data.history.slice(-30).map((h) => ({ date: h.date, actual: h.revenue, forecast: undefined as number | undefined })),
    ...data.forecast.map((f) => ({ date: f.date, actual: undefined as number | undefined, forecast: f.revenue })),
  ];

  return (
    <div>
      <div className="mb-4 flex items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-gray-500">{t("reports.forecastHorizon")}</label>
          <div className="flex gap-2">
            <Button variant={horizonDays === 30 ? "primary" : "secondary"} onClick={() => setHorizonDays(30)}>
              {t("reports.days30")}
            </Button>
            <Button variant={horizonDays === 60 ? "primary" : "secondary"} onClick={() => setHorizonDays(60)}>
              {t("reports.days60")}
            </Button>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label={t("reports.totalForecastRevenue")} value={data.totalForecastRevenue} highlight />
        <StatCard label={t("reports.dailyAverageForecast")} value={data.dailyAverageForecast} />
      </div>

      <p className="mb-4 text-sm text-gray-600">{t(trendKey)}</p>

      <div className="mb-3 h-64 rounded-xl border border-gray-200 bg-white p-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="actual" name={t("reports.salesOverTime")} stroke="#1f7a64" dot={false} />
            <Line
              type="monotone"
              dataKey="forecast"
              name={t("reports.forecast")}
              stroke="#b45309"
              strokeDasharray="5 5"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-gray-400">{t("reports.forecastDisclaimer")}</p>
    </div>
  );
}
