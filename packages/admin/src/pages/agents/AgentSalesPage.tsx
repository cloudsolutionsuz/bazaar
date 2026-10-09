import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import * as agentsApi from "../../api/agents";
import { useAuth } from "../../auth/AuthContext";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { dayEndParam, dayStartParam, monthEndInputValue, monthStartInputValue } from "../../utils/dateInput";
import { STATUS_LABEL_KEYS } from "../orders/OrdersListPage";
import { CopyLinkButton } from "./CopyLinkButton";
import { formatBonus } from "./BonusFields";
import { SalesTab } from "./SalesTab";
import { PayoutsTab } from "./PayoutsTab";
import { ReconciliationTab } from "./ReconciliationTab";
import type { OrderStatus } from "../../types/api";

type Tab = "sales" | "payouts" | "reconciliation";
const TABS: Tab[] = ["sales", "payouts", "reconciliation"];
// PROCESSING is a legacy status no new order can enter.
const FILTERABLE_STATUSES = (Object.keys(STATUS_LABEL_KEYS) as OrderStatus[]).filter((s) => s !== "PROCESSING");

// One page for two audiences: shop staff see every agent (and can narrow to
// one); an agent sees only their own numbers - the API enforces that, the
// agent picker is simply not rendered for them.
export function AgentSalesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAgent = user?.role === "AGENT";

  const [tab, setTab] = useState<Tab>("sales");
  // "This month" is the default view.
  const [from, setFrom] = useState(monthStartInputValue);
  const [to, setTo] = useState(monthEndInputValue);
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [payment, setPayment] = useState<agentsApi.AgentPaymentFilter | "">("");
  const [agentId, setAgentId] = useState("");

  const agentsQuery = useQuery({ queryKey: ["agents"], queryFn: agentsApi.listAgents, enabled: !isAgent });
  const profileQuery = useQuery({ queryKey: ["agents", "me"], queryFn: agentsApi.getMyAgentProfile, enabled: isAgent });
  const profile = profileQuery.data?.agent;

  const isThisMonth = from === monthStartInputValue() && to === monthEndInputValue();
  const period: agentsApi.AgentPeriodParams = {
    from: dayStartParam(from),
    to: dayEndParam(to),
    agentId: agentId || undefined,
  };

  function selectThisMonth() {
    setFrom(monthStartInputValue());
    setTo(monthEndInputValue());
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-gray-900">{t("agentSales.title")}</h1>

      {isAgent && profile && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-1 text-sm font-medium text-gray-900 dark:text-gray-100">{profile.fullName}</div>
          <div className="mb-2 text-xs text-gray-500">
            {t("agentSales.yourBonus")}: {formatBonus(profile.bonusType, profile.bonusValue, t("common.sum"))}
          </div>
          <div className="text-xs text-gray-500">{t("agentSales.yourLink")}</div>
          <CopyLinkButton link={profile.link} />
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-gray-500">{t("reports.from")}</label>
          <Input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">{t("reports.to")}</label>
          <Input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Button variant={isThisMonth ? "primary" : "secondary"} onClick={selectThisMonth}>
          {t("agentSales.thisMonth")}
        </Button>
        {!isAgent && (
          <div>
            <label className="mb-1 block text-xs text-gray-500">{t("agentSales.agent")}</label>
            <Select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
              <option value="">{t("agentSales.allAgents")}</option>
              {(agentsQuery.data?.agents ?? []).map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.fullName}
                </option>
              ))}
            </Select>
          </div>
        )}
        {tab === "sales" && (
          <>
            <div>
              <label className="mb-1 block text-xs text-gray-500">{t("agentSales.orderStatus")}</label>
              <Select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus | "")}>
                <option value="">{t("common.all")}</option>
                {FILTERABLE_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {t(STATUS_LABEL_KEYS[value])}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">{t("agentSales.payment")}</label>
              <Select value={payment} onChange={(e) => setPayment(e.target.value as agentsApi.AgentPaymentFilter | "")}>
                <option value="">{t("common.all")}</option>
                <option value="paid">{t("agentSales.paymentPaid")}</option>
                <option value="unpaid">{t("agentSales.paymentUnpaid")}</option>
              </Select>
            </div>
          </>
        )}
      </div>

      <div className="mb-4 flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {TABS.map((value) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === value ? "border-brand-600 text-brand-700 dark:text-brand-300" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t(`agentSales.tab.${value}`)}
          </button>
        ))}
      </div>

      {tab === "sales" && <SalesTab period={period} status={status} payment={payment} showAgent={!isAgent} />}
      {tab === "payouts" && <PayoutsTab period={period} showAgent={!isAgent} />}
      {tab === "reconciliation" && <ReconciliationTab period={period} />}
    </div>
  );
}
