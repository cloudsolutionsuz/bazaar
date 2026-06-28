import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as suppliersApi from "../../api/suppliers";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Badge } from "../../components/ui/Badge";
import { StatCard } from "../../components/ui/StatCard";
import { Table, Thead, Tbody, Th, Td } from "../../components/ui/Table";
import { downloadBlob } from "../../utils/downloadBlob";
import { useActiveCashRegisters } from "../../hooks/useActiveCashRegisters";
import type { SupplierStatementEntry } from "../../types/api";

const ENTRY_LABEL_KEYS: Record<SupplierStatementEntry["type"], string> = {
  RECEIPT: "suppliers.entryReceipt",
  SUPPLIER_RETURN: "suppliers.entrySupplierReturn",
  PAYMENT: "suppliers.entryPayment",
};

const ENTRY_COLORS: Record<SupplierStatementEntry["type"], "green" | "blue" | "red"> = {
  RECEIPT: "red",
  SUPPLIER_RETURN: "blue",
  PAYMENT: "green",
};

export function SupplierDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [cashRegisterId, setCashRegisterId] = useState("");

  const { activeRegisters, defaultRegisterId } = useActiveCashRegisters();

  const query = useQuery({
    queryKey: ["supplier", id, { from, to }],
    queryFn: () => suppliersApi.getSupplierStatement(id as string, { from: from || undefined, to: to || undefined }),
  });

  const payMutation = useMutation({
    mutationFn: (input: suppliersApi.CreateSupplierPaymentInput) => suppliersApi.createSupplierPayment(id as string, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier", id] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      setAmount("");
      setDescription("");
    },
  });

  function handlePay(e: FormEvent) {
    e.preventDefault();
    payMutation.mutate({ amount: Number(amount), cashRegisterId: cashRegisterId || defaultRegisterId, description: description || undefined });
  }

  async function handleExport() {
    const blob = await suppliersApi.exportSupplierStatement(id as string, { from: from || undefined, to: to || undefined });
    downloadBlob(blob, "supplier-statement.xlsx");
  }

  const statement = query.data;
  if (!statement) return null;

  return (
    <div className="max-w-4xl">
      <Link to="/suppliers" className="mb-4 inline-block text-sm text-brand-600 hover:underline">
        ← {t("common.back")}
      </Link>

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-gray-900">{statement.supplier.name}</h1>
        <p className="text-sm text-gray-500">{statement.supplier.phone ?? "—"}</p>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatCard label={t("suppliers.openingBalance")} value={statement.openingBalance} />
          <StatCard label={t("suppliers.closingBalance")} value={statement.closingBalance} highlight />
        </div>
      </div>

      <div className="mb-6 max-w-md rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">{t("suppliers.payment")}</h2>
        <form onSubmit={handlePay} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t("suppliers.payAmount")}</label>
            <Input required type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t("kassa.register")}</label>
            <Select value={cashRegisterId || defaultRegisterId} onChange={(e) => setCashRegisterId(e.target.value)} className="w-full">
              {activeRegisters.map((register) => (
                <option key={register.id} value={register.id}>
                  {register.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t("kassa.description")}</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full" />
          </div>
          <Button type="submit" disabled={payMutation.isPending || !amount}>
            {t("suppliers.pay")}
          </Button>
        </form>
      </div>

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-gray-500">{t("reports.from")}</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">{t("reports.to")}</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <Button variant="secondary" onClick={handleExport}>
          {t("common.export")}
        </Button>
      </div>

      <h2 className="mb-3 text-lg font-semibold text-gray-900">{t("suppliers.statement")}</h2>
      <Table>
        <Thead>
          <tr>
            <Th>{t("orders.date")}</Th>
            <Th>{t("kassa.type")}</Th>
            <Th>{t("suppliers.description")}</Th>
            <Th>{t("suppliers.debit")}</Th>
            <Th>{t("suppliers.credit")}</Th>
            <Th>{t("suppliers.balance")}</Th>
          </tr>
        </Thead>
        <Tbody>
          {statement.entries.map((entry, index) => (
            <tr key={index}>
              <Td>{new Date(entry.date).toLocaleString()}</Td>
              <Td>
                <Badge color={ENTRY_COLORS[entry.type]}>{t(ENTRY_LABEL_KEYS[entry.type])}</Badge>
              </Td>
              <Td>{entry.description}</Td>
              <Td className="text-red-600">{entry.debit ? entry.debit.toLocaleString() : "—"}</Td>
              <Td className="text-green-600">{entry.credit ? entry.credit.toLocaleString() : "—"}</Td>
              <Td className="font-medium">{entry.balanceAfter.toLocaleString()}</Td>
            </tr>
          ))}
          {statement.entries.length === 0 && (
            <tr>
              <Td colSpan={6} className="text-center text-gray-400">
                {t("common.noData")}
              </Td>
            </tr>
          )}
        </Tbody>
      </Table>
    </div>
  );
}
