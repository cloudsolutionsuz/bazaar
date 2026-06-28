import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as financeApi from "../../api/finance";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Badge } from "../../components/ui/Badge";
import { StatCard } from "../../components/ui/StatCard";
import { Table, Thead, Tbody, Th, Td } from "../../components/ui/Table";
import { todayInputValue } from "../../utils/dateInput";
import type { TransactionType } from "../../types/api";

export function KassaPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(todayInputValue());
  const [filterType, setFilterType] = useState<TransactionType | "">("");
  const [adding, setAdding] = useState(false);
  const [formType, setFormType] = useState<TransactionType>("EXPENSE");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const summaryQuery = useQuery({ queryKey: ["finance", "daily-summary", date], queryFn: () => financeApi.getDailySummary(date) });
  const transactionsQuery = useQuery({
    queryKey: ["finance", "transactions", { type: filterType, date }],
    queryFn: () =>
      financeApi.listTransactions({
        type: filterType || undefined,
        from: `${date}T00:00:00`,
        to: `${date}T23:59:59`,
        pageSize: 50,
      }),
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

  const summary = summaryQuery.data;
  const transactions = transactionsQuery.data?.items ?? [];

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">{t("kassa.title")}</h1>
        {!adding && <Button onClick={() => setAdding(true)}>{t("kassa.addTransaction")}</Button>}
      </div>

      {summary && (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label={t("kassa.openingBalance")} value={summary.openingBalance} />
          <StatCard label={t("kassa.income")} value={summary.income} />
          <StatCard label={t("kassa.expense")} value={summary.expense} />
          <StatCard label={t("kassa.actualBalance")} value={summary.closingBalance} highlight />
        </div>
      )}
      {summary && summary.pendingIncome > 0 && (
        <p className="mb-6 text-sm text-gray-500">{t("kassa.pendingHint", { amount: summary.pendingIncome.toLocaleString() })}</p>
      )}

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

      <PendingSection />

      <h2 className="mb-3 text-lg font-semibold text-gray-900">{t("kassa.history")}</h2>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-gray-500">{t("reports.from")}</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">{t("common.status")}</label>
          <Select value={filterType} onChange={(e) => setFilterType(e.target.value as TransactionType | "")}>
            <option value="">{t("common.all")}</option>
            <option value="INCOME">{t("kassa.income")}</option>
            <option value="EXPENSE">{t("kassa.expense")}</option>
          </Select>
        </div>
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

function PendingSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const query = useQuery({
    queryKey: ["finance", "pending", search],
    queryFn: () => financeApi.listPendingTransactions(search || undefined),
  });

  const confirmMutation = useMutation({
    mutationFn: financeApi.confirmTransaction,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["finance"] }),
  });

  const items = query.data?.items ?? [];

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold text-gray-900">{t("kassa.pendingTitle")}</h2>
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("kassa.pendingSearchPlaceholder")}
        className="mb-3 w-full max-w-sm"
      />
      <Table>
        <Thead>
          <tr>
            <Th>{t("orders.date")}</Th>
            <Th>{t("orders.customer")}</Th>
            <Th>{t("orders.phone")}</Th>
            <Th>{t("kassa.amount")}</Th>
            <Th>{t("common.actions")}</Th>
          </tr>
        </Thead>
        <Tbody>
          {items.map((tx) => (
            <tr key={tx.id}>
              <Td>{new Date(tx.createdAt).toLocaleString()}</Td>
              <Td>{tx.order?.customerName ?? "—"}</Td>
              <Td>{tx.order?.customerPhone ?? "—"}</Td>
              <Td className="text-green-600">+{tx.amount.toLocaleString()}</Td>
              <Td>
                <Button variant="secondary" disabled={confirmMutation.isPending} onClick={() => confirmMutation.mutate(tx.id)}>
                  {t("kassa.confirm")}
                </Button>
              </Td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <Td colSpan={5} className="text-center text-gray-400">
                {t("common.noData")}
              </Td>
            </tr>
          )}
        </Tbody>
      </Table>
    </section>
  );
}
