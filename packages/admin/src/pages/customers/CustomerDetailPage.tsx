import { type FormEvent, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as customersApi from "../../api/customers";
import * as financeApi from "../../api/finance";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { NumberInput } from "../../components/ui/NumberInput";
import { Select } from "../../components/ui/Select";
import { Table, Thead, Tbody, Th, Td } from "../../components/ui/Table";
import { STATUS_COLORS, STATUS_LABEL_KEYS } from "../orders/OrdersListPage";
import { regionName, districtName } from "../../utils/addressLabels";
import { useActiveCashRegisters } from "../../hooks/useActiveCashRegisters";

export function CustomerDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [payAmount, setPayAmount] = useState("");
  const [payDescription, setPayDescription] = useState("");
  const [payCashRegisterId, setPayCashRegisterId] = useState("");
  const [paySuccess, setPaySuccess] = useState(false);
  const [loyaltyDelta, setLoyaltyDelta] = useState("");
  const [loyaltyReason, setLoyaltyReason] = useState("");
  const [loyaltySuccess, setLoyaltySuccess] = useState(false);
  const { activeRegisters, defaultRegisterId } = useActiveCashRegisters();

  const query = useQuery({
    queryKey: ["customer", id],
    queryFn: () => customersApi.getCustomer(id as string),
  });

  const payMutation = useMutation({
    mutationFn: (input: financeApi.CreateTransactionInput) => financeApi.createTransaction(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", id] });
      setPayAmount("");
      setPayDescription("");
      setPaySuccess(true);
      setTimeout(() => setPaySuccess(false), 3000);
    },
  });

  const loyaltyMutation = useMutation({
    mutationFn: ({ delta, reason }: { delta: number; reason: string }) =>
      customersApi.adjustLoyaltyPoints(id as string, delta, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", id] });
      setLoyaltyDelta("");
      setLoyaltyReason("");
      setLoyaltySuccess(true);
      setTimeout(() => setLoyaltySuccess(false), 3000);
    },
  });

  function handlePay(e: FormEvent) {
    e.preventDefault();
    const registerId = payCashRegisterId || defaultRegisterId;
    if (!registerId) return;
    payMutation.mutate({
      type: "INCOME",
      category: "customer_payment",
      amount: Number(payAmount),
      description: payDescription || undefined,
      cashRegisterId: registerId,
      customerId: id,
    });
  }

  const customer = query.data?.customer;
  if (!customer) return null;

  return (
    <div>
      <Link to="/customers" className="mb-4 inline-block text-sm text-brand-600 hover:underline">
        ← {t("common.back")}
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer info */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h1 className="text-lg font-semibold text-gray-900">{customer.name}</h1>
            <p className="mb-4 text-sm text-gray-500">{customer.phone}</p>
            <p className="mb-4 text-xs text-gray-400">
              {regionName(customer.addressRegion)}, {districtName(customer.addressRegion, customer.addressDistrict)}
              {customer.addressMahalla ? `, ${customer.addressMahalla}` : ""}
            </p>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-gray-500">{t("customers.purchaseAmount")}</dt>
                <dd className="font-semibold">{customer.purchaseAmount.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">{t("customers.paidAmount")}</dt>
                <dd className="font-semibold">{customer.paidAmount.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">{t("customers.balance")}</dt>
                <dd className={`font-semibold ${customer.balance > 0 ? "text-red-600" : ""}`}>{customer.balance.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">{t("customers.orderCount")}</dt>
                <dd className="font-semibold">{customer.orderCount}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">{t("customers.loyaltyPoints")}</dt>
                <dd className="font-semibold text-yellow-700">{customer.loyaltyPoints.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">{t("customers.customerSince")}</dt>
                <dd className="font-semibold">{new Date(customer.createdAt).toLocaleDateString()}</dd>
              </div>
            </dl>
          </div>

          {/* Record payment */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 font-semibold text-gray-900">{t("customers.recordPayment")}</h2>
            <form onSubmit={handlePay} className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t("customers.payAmount")}</label>
                <NumberInput min={1} required value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="w-full text-left" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t("kassa.description")}</label>
                <Input value={payDescription} onChange={(e) => setPayDescription(e.target.value)} className="w-full" />
              </div>
              {activeRegisters.length > 1 && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">{t("kassa.register")}</label>
                  <Select value={payCashRegisterId || defaultRegisterId} onChange={(e) => setPayCashRegisterId(e.target.value)} className="w-full">
                    {activeRegisters.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </Select>
                </div>
              )}
              <Button type="submit" disabled={!payAmount || payMutation.isPending}>{t("customers.pay")}</Button>
              {paySuccess && <span className="text-sm text-green-600">{t("customers.paySuccess")}</span>}
            </form>
          </div>

          {/* Loyalty */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 font-semibold text-gray-900">{t("customers.adjustLoyalty")}</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const delta = Number(loyaltyDelta);
                if (delta === 0) return;
                loyaltyMutation.mutate({ delta, reason: loyaltyReason });
              }}
              className="space-y-3"
            >
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t("customers.loyaltyDelta")}</label>
                <Input type="number" value={loyaltyDelta} onChange={(e) => setLoyaltyDelta(e.target.value)} placeholder="+100 / -50" className="w-full" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t("customers.loyaltyReason")}</label>
                <Input value={loyaltyReason} onChange={(e) => setLoyaltyReason(e.target.value)} className="w-full" />
              </div>
              <Button type="submit" disabled={!loyaltyDelta || loyaltyMutation.isPending}>{t("customers.loyaltyAdjust")}</Button>
              {loyaltySuccess && <span className="text-sm text-green-600">{t("customers.loyaltySuccess")}</span>}
              {loyaltyMutation.isError && <span className="text-sm text-red-600">{t("customers.loyaltyError")}</span>}
            </form>
          </div>
        </div>

        {/* Orders table */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="font-semibold text-gray-900">{t("customers.purchases")}</h2>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <Thead>
                  <tr>
                    <Th>{t("orders.date")}</Th>
                    <Th>{t("common.status")}</Th>
                    <Th>{t("orders.region")}</Th>
                    <Th>{t("orders.district")}</Th>
                    <Th>{t("orders.total")}</Th>
                    <Th>{t("common.actions")}</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {customer.orders.map((o) => (
                    <tr key={o.id}>
                      <Td>{new Date(o.createdAt).toLocaleString()}</Td>
                      <Td><Badge color={STATUS_COLORS[o.status]}>{t(STATUS_LABEL_KEYS[o.status])}</Badge></Td>
                      <Td>{regionName(o.addressRegion)}</Td>
                      <Td>{districtName(o.addressRegion, o.addressDistrict)}</Td>
                      <Td>{o.totalAmount.toLocaleString()}</Td>
                      <Td><Link to={`/orders/${o.id}`} className="text-brand-600 hover:underline">{t("common.edit")}</Link></Td>
                    </tr>
                  ))}
                  {customer.orders.length === 0 && (
                    <tr><Td colSpan={6} className="text-center text-gray-400">{t("common.noData")}</Td></tr>
                  )}
                </Tbody>
              </Table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
