import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as financeApi from "../../api/finance";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Badge } from "../../components/ui/Badge";
import { Table, Thead, Tbody, Th, Td } from "../../components/ui/Table";
import type { TransactionType } from "../../types/api";

export function KassaPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState<TransactionType | "">("");
  const [adding, setAdding] = useState(false);
  const [formType, setFormType] = useState<TransactionType>("EXPENSE");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const balanceQuery = useQuery({ queryKey: ["finance", "balance"], queryFn: financeApi.getBalance });
  const transactionsQuery = useQuery({
    queryKey: ["finance", "transactions", { type: filterType }],
    queryFn: () => financeApi.listTransactions({ type: filterType || undefined, pageSize: 50 }),
  });

  const createMutation = useMutation({
    mutationFn: financeApi.createTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      setAdding(false);
      setCategory("");
      setAmount("");
      setDescription("");
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    createMutation.mutate({ type: formType, category, amount: Number(amount), description: description || undefined });
  }

  const balance = balanceQuery.data?.balance ?? 0;
  const transactions = transactionsQuery.data?.items ?? [];

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">{t("kassa.title")}</h1>
        {!adding && <Button onClick={() => setAdding(true)}>{t("kassa.addTransaction")}</Button>}
      </div>

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
        <div className="text-sm text-gray-500">{t("kassa.balance")}</div>
        <div className={`text-3xl font-semibold ${balance >= 0 ? "text-gray-900" : "text-red-600"}`}>{balance.toLocaleString()}</div>
      </div>

      {adding && (
        <form onSubmit={handleSubmit} className="mb-6 space-y-4 rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" checked={formType === "INCOME"} onChange={() => setFormType("INCOME")} />
              {t("kassa.income")}
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={formType === "EXPENSE"} onChange={() => setFormType("EXPENSE")} />
              {t("kassa.expense")}
            </label>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t("kassa.category")}</label>
            <Input required value={category} onChange={(e) => setCategory(e.target.value)} className="w-full" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t("kassa.amount")}</label>
            <Input required type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t("kassa.description")}</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full" />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={createMutation.isPending}>
              {t("common.save")}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setAdding(false)}>
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      )}

      <div className="mb-4">
        <Select value={filterType} onChange={(e) => setFilterType(e.target.value as TransactionType | "")}>
          <option value="">{t("common.all")}</option>
          <option value="INCOME">{t("kassa.income")}</option>
          <option value="EXPENSE">{t("kassa.expense")}</option>
        </Select>
      </div>

      <Table>
        <Thead>
          <tr>
            <Th>{t("orders.date")}</Th>
            <Th>{t("kassa.type")}</Th>
            <Th>{t("kassa.category")}</Th>
            <Th>{t("kassa.amount")}</Th>
            <Th>{t("kassa.description")}</Th>
          </tr>
        </Thead>
        <Tbody>
          {transactions.map((transaction) => (
            <tr key={transaction.id}>
              <Td>{new Date(transaction.createdAt).toLocaleString()}</Td>
              <Td>
                <Badge color={transaction.type === "INCOME" ? "green" : "red"}>
                  {transaction.type === "INCOME" ? t("kassa.income") : t("kassa.expense")}
                </Badge>
              </Td>
              <Td>{transaction.category}</Td>
              <Td className={transaction.type === "INCOME" ? "text-green-600" : "text-red-600"}>
                {transaction.type === "INCOME" ? "+" : "-"}
                {transaction.amount.toLocaleString()}
              </Td>
              <Td>{transaction.description ?? "—"}</Td>
            </tr>
          ))}
          {transactions.length === 0 && (
            <tr>
              <Td colSpan={5} className="text-center text-gray-400">
                {t("common.noData")}
              </Td>
            </tr>
          )}
        </Tbody>
      </Table>
    </div>
  );
}
