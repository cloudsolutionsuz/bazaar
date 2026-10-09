import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import * as agentsApi from "../../api/agents";
import { Button } from "../../components/ui/Button";
import { Table, Thead, Tbody, Th, Td } from "../../components/ui/Table";
import { downloadBlob } from "../../utils/downloadBlob";

const COLUMN_COUNT = 8;

// Akt-sverka: per agent, what was owed when the period began, what was
// earned (orders archived) and paid during it, and what is owed at its end.
export function ReconciliationTab({ period }: { period: agentsApi.AgentPeriodParams }) {
  const { t } = useTranslation();
  const [exportError, setExportError] = useState(false);
  const query = useQuery({
    queryKey: ["agents", "reconciliation", JSON.stringify(period)],
    queryFn: () => agentsApi.getReconciliation(period),
  });

  const rows = query.data?.rows ?? [];
  const totals = query.data?.totals;

  async function handleExport() {
    setExportError(false);
    try {
      downloadBlob(await agentsApi.exportReconciliation(period), "akt-sverka.xlsx");
    } catch {
      setExportError(true);
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">{t("agentSales.reconciliationHint")}</p>
        <Button variant="secondary" onClick={() => void handleExport()} disabled={rows.length === 0}>
          {t("common.export")}
        </Button>
      </div>
      {(query.isError || exportError) && <p className="mb-3 text-sm text-red-600">{t("common.error")}</p>}

      <Table>
        <Thead>
          <tr>
            <Th>{t("agentSales.agent")}</Th>
            <Th>{t("agents.phone")}</Th>
            <Th>{t("agentSales.openingBalance")}</Th>
            <Th>{t("agentSales.archivedOrders")}</Th>
            <Th>{t("agentSales.salesAmount")}</Th>
            <Th>{t("agentSales.accrued")}</Th>
            <Th>{t("agentSales.paid")}</Th>
            <Th>{t("agentSales.closingBalance")}</Th>
          </tr>
        </Thead>
        <Tbody>
          {rows.map((row) => (
            <tr key={row.agentId}>
              <Td className="font-medium">{row.fullName}</Td>
              <Td className="whitespace-nowrap">+{row.phone}</Td>
              <Td>{row.openingBalance.toLocaleString()}</Td>
              <Td>{row.archivedCount}</Td>
              <Td>{row.salesAmount.toLocaleString()}</Td>
              <Td>{row.accrued.toLocaleString()}</Td>
              <Td>{row.paid.toLocaleString()}</Td>
              <Td className={`font-semibold ${row.closingBalance > 0 ? "text-red-600" : ""}`}>{row.closingBalance.toLocaleString()}</Td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <Td colSpan={COLUMN_COUNT} className="text-center text-gray-400">
                {query.isLoading ? t("common.loading") : t("common.noData")}
              </Td>
            </tr>
          )}
          {totals && rows.length > 1 && (
            <tr className="bg-gray-50 font-semibold dark:bg-gray-800">
              <Td colSpan={2}>{t("common.total")}</Td>
              <Td>{totals.openingBalance.toLocaleString()}</Td>
              <Td>{totals.archivedCount}</Td>
              <Td>{totals.salesAmount.toLocaleString()}</Td>
              <Td>{totals.accrued.toLocaleString()}</Td>
              <Td>{totals.paid.toLocaleString()}</Td>
              <Td>{totals.closingBalance.toLocaleString()}</Td>
            </tr>
          )}
        </Tbody>
      </Table>
    </div>
  );
}
