import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import * as agentsApi from "../../api/agents";
import { StatCard } from "../../components/ui/StatCard";
import { Table, Thead, Tbody, Th, Td } from "../../components/ui/Table";

interface PayoutsTabProps {
  period: agentsApi.AgentPeriodParams;
  showAgent: boolean;
}

// The money actually handed over: one row per Kassa payment, with how many
// orders' bonuses it covered and the total for the chosen period.
export function PayoutsTab({ period, showAgent }: PayoutsTabProps) {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: ["agents", "payouts", JSON.stringify(period)],
    queryFn: () => agentsApi.getPayouts(period),
  });

  const rows = query.data?.items ?? [];
  const columnCount = showAgent ? 4 : 3;

  return (
    <div>
      {query.isError && <p className="mb-3 text-sm text-red-600">{t("common.error")}</p>}

      {query.data && (
        <div className="mb-5 grid grid-cols-2 gap-4 sm:max-w-md">
          <StatCard label={t("agentSales.payoutCount")} value={query.data.count} isCount />
          <StatCard label={t("agentSales.payoutTotal")} value={query.data.totalAmount} />
        </div>
      )}

      <Table>
        <Thead>
          <tr>
            <Th>{t("orders.date")}</Th>
            {showAgent && <Th>{t("agentSales.agent")}</Th>}
            <Th>{t("agentSales.payoutOrders")}</Th>
            <Th>{t("kassa.amount")}</Th>
          </tr>
        </Thead>
        <Tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <Td className="whitespace-nowrap">{new Date(row.createdAt).toLocaleString()}</Td>
              {showAgent && <Td>{row.agentName}</Td>}
              <Td>{row.orderCount}</Td>
              <Td className="font-medium text-green-600">{row.amount.toLocaleString()}</Td>
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
    </div>
  );
}
