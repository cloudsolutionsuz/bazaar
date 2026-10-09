import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as agentsApi from "../../api/agents";
import { ApiError } from "../../api/client";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { Table, Thead, Tbody, Th, Td } from "../../components/ui/Table";
import { shortOrderId } from "../../utils/orderId";
import type { CashRegister } from "../../types/api";

const COLUMN_COUNT = 6;

interface AgentPayoutModalProps {
  open: boolean;
  onClose: () => void;
  activeRegisters: CashRegister[];
  defaultRegisterId: string;
}

// Paying an agent: pick the agent, see only their archived orders whose
// bonus hasn't been paid yet, tick which ones to pay, and the sum of those
// bonuses leaves the chosen register as one expense.
export function AgentPayoutModal({ open, onClose, activeRegisters, defaultRegisterId }: AgentPayoutModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [agentId, setAgentId] = useState("");
  const [registerId, setRegisterId] = useState(defaultRegisterId);
  // Orders the cashier unticked; everything else is paid. Tracking the
  // exclusions keeps "all selected" the default as the list loads.
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [paidMessage, setPaidMessage] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAgentId("");
      setRegisterId(defaultRegisterId);
      setExcludedIds([]);
      setError(null);
      setPaidMessage(null);
    }
  }, [open, defaultRegisterId]);

  const agentsQuery = useQuery({ queryKey: ["agents"], queryFn: agentsApi.listAgents, enabled: open });
  const unpaidQuery = useQuery({
    queryKey: ["agents", "unpaid-orders", agentId],
    queryFn: () => agentsApi.getUnpaidOrders(agentId),
    enabled: open && agentId !== "",
  });

  const orders = unpaidQuery.data?.items ?? [];
  const selected = orders.filter((o) => !excludedIds.includes(o.id));
  const selectedAmount = selected.reduce((sum, o) => sum + o.agentBonus, 0);
  const allSelected = orders.length > 0 && selected.length === orders.length;

  const payMutation = useMutation({
    mutationFn: () => agentsApi.createPayout(agentId, selected.map((o) => o.id), registerId),
    onSuccess: (data) => {
      setPaidMessage(t("agentPayout.success", { amount: data.payout.amount.toLocaleString(), count: data.payout.orderCount }));
      setExcludedIds([]);
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
    onError: (err) => {
      // Someone else paid (part of) this in the meantime - show the fresh list.
      const stale = err instanceof ApiError && (err.code === "INVALID_ORDERS" || err.code === "ALREADY_PAID");
      setError(stale ? t("agentPayout.errorStale") : t("common.error"));
      if (stale) queryClient.invalidateQueries({ queryKey: ["agents", "unpaid-orders", agentId] });
    },
  });

  function selectAgent(id: string) {
    setAgentId(id);
    setExcludedIds([]);
    setError(null);
    setPaidMessage(null);
  }

  function toggleOrder(id: string) {
    setExcludedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handlePay() {
    setError(null);
    setPaidMessage(null);
    payMutation.mutate();
  }

  const agents = agentsQuery.data?.agents ?? [];

  return (
    <Modal open={open} onClose={onClose} title={t("agentPayout.title")} size="wide">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-gray-500">{t("agentSales.agent")}</label>
          <Select value={agentId} onChange={(e) => selectAgent(e.target.value)} className="min-w-[16rem]">
            <option value="">{t("agentPayout.selectAgent")}</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.fullName} — {agent.bonusBalance.toLocaleString()}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">{t("kassa.register")}</label>
          <Select value={registerId} onChange={(e) => setRegisterId(e.target.value)}>
            {activeRegisters.map((register) => (
              <option key={register.id} value={register.id}>
                {register.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {agentId === "" ? (
        <p className="text-sm text-gray-500">{agents.length === 0 && !agentsQuery.isLoading ? t("agents.empty") : t("agentPayout.selectAgentHint")}</p>
      ) : (
        <>
          <Table>
            <Thead>
              <tr>
                <Th>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    disabled={orders.length === 0}
                    onChange={() => setExcludedIds(allSelected ? orders.map((o) => o.id) : [])}
                    aria-label={t("agentPayout.selectAll")}
                  />
                </Th>
                <Th>{t("orders.id")}</Th>
                <Th>{t("agentPayout.archivedAt")}</Th>
                <Th>{t("orders.customer")}</Th>
                <Th>{t("orders.total")}</Th>
                <Th>{t("agentSales.bonus")}</Th>
              </tr>
            </Thead>
            <Tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <Td>
                    <input type="checkbox" checked={!excludedIds.includes(order.id)} onChange={() => toggleOrder(order.id)} />
                  </Td>
                  <Td className="whitespace-nowrap font-mono text-xs text-gray-500">{shortOrderId(order.id)}</Td>
                  <Td className="whitespace-nowrap">
                    {new Date(order.agentBonusAccruedAt ?? order.createdAt).toLocaleDateString()}
                  </Td>
                  <Td>{order.customerName}</Td>
                  <Td>{order.totalAmount.toLocaleString()}</Td>
                  <Td className="font-medium">{order.agentBonus.toLocaleString()}</Td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <Td colSpan={COLUMN_COUNT} className="text-center text-gray-400">
                    {unpaidQuery.isLoading ? t("common.loading") : unpaidQuery.isError ? t("common.error") : t("agentPayout.nothingToPay")}
                  </Td>
                </tr>
              )}
            </Tbody>
          </Table>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="space-y-1">
              <div className="text-gray-600 dark:text-gray-300">
                {t("agentPayout.totalUnpaid")}:{" "}
                <span className="font-semibold text-gray-900 dark:text-gray-100">{(unpaidQuery.data?.totalAmount ?? 0).toLocaleString()}</span>
              </div>
              <div className="text-gray-600 dark:text-gray-300">
                {t("agentPayout.selected", { count: selected.length })}:{" "}
                <span className="text-base font-semibold text-brand-700 dark:text-brand-300">{selectedAmount.toLocaleString()}</span>
              </div>
            </div>
            <Button onClick={handlePay} disabled={payMutation.isPending || selected.length === 0 || selectedAmount === 0 || !registerId}>
              {t("agentPayout.pay", { amount: selectedAmount.toLocaleString() })}
            </Button>
          </div>
        </>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {paidMessage && <p className="mt-3 text-sm font-medium text-green-600">✓ {paidMessage}</p>}

      <div className="mt-4 flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          {t("common.close")}
        </Button>
      </div>
    </Modal>
  );
}
