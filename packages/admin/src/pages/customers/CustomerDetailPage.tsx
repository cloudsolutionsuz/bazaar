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
    <div className="max-w-4xl">
      <Link to="/customers" className="mb-4 inline-block text-sm text-brand-600 hover:underline">
        ← {t("common.back")}
      </Link>

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-gray-900">{customer.name}</h1>
        <p className="text-sm text-gray-500">{customer.phone}</p>
        <p className="text-sm text-gray-500">
          {regionName(customer.addressRegion)}, {districtName(customer.addressRegion, customer.addressDistrict)}
          {customer.addressMahalla ? `, ${customer.addressMahalla}` : ""}
        </p>

        <div className="mt-4 grid grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-gray-500">{t("customers.purchaseAmount")}</div>
            <div className="text-xl font-semibold text-gray-900">{customer.purchaseAmount.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">{t("customers.paidAmount")}</div>
            <div className="text-xl font-semibold text-gray-900">{customer.paidAmount.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">{t("customers.balance")}</div>
            <div className={`text-xl font-semibold ${customer.balance > 0 ? "text-red-600" : "text-gray-900"}`}>
              {customer.balance.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500">{t("customers.orderCount")}</div>
            <div className="text-xl font-semibold text-gray-900">{customer.orderCount}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">{t("customers.loyaltyPoints")}</div>
            <div className="text-xl font-semibold text-yellow-700">{customer.loyaltyPoints.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">{t("customers.customerSince")}</div>
            <div className="text-xl font-semibold text-gray-900">{new Date(customer.createdAt).toLocaleDateString()}</div>
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">{t("customers.recordPayment")}</h2>
        <form onSubmit={handlePay} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t("customers.payAmount")}</label>
            <NumberInput
              min={1}
              required
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className="w-40 text-left"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t("kassa.description")}</label>
            <Input value={payDescription} onChange={(e) => setPayDescription(e.target.value)} className="w-52" />
          </div>
          {activeRegisters.length > 1 && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t("kassa.register")}</label>
              <Select
                value={payCashRegisterId || defaultRegisterId}
                onChange={(e) => setPayCashRegisterId(e.target.value)}
                className="w-40"
              >
                {activeRegisters.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </Select>
            </div>
          )}
          <Button type="submit" disabled={!payAmount || payMutation.isPending}>
            {t("customers.pay")}
          </Button>
          {paySuccess && <span className="text-sm text-green-600">{t("customers.paySuccess")}</span>}
        </form>
      </div>

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">{t("customers.adjustLoyalty")}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const delta = Number(loyaltyDelta);
            if (delta === 0) return;
            loyaltyMutation.mutate({ delta, reason: loyaltyReason });
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t("customers.loyaltyDelta")}</label>
            <Input
              type="number"
              value={loyaltyDelta}
              onChange={(e) => setLoyaltyDelta(e.target.value)}
              placeholder="+100 / -50"
              className="w-32"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t("customers.loyaltyReason")}</label>
            <Input value={loyaltyReason} onChange={(e) => setLoyaltyReason(e.target.value)} className="w-52" />
          </div>
          <Button type="submit" disabled={!loyaltyDelta || loyaltyMutation.isPending}>
            {t("customers.loyaltyAdjust")}
          </Button>
          {loyaltySuccess && <span className="text-sm text-green-600">{t("customers.loyaltySuccess")}</span>}
          {loyaltyMutation.isError && <span className="text-sm text-red-600">{t("customers.loyaltyError")}</span>}
        </form>
      </div>

      <h2 className="mb-3 text-lg font-semibold text-gray-900">{t("customers.purchases")}</h2>
      <Table>
        <Thead>
          <tr>
            <Th>{t("orders.date")}</Th>
            <Th>{t("common.status")}</Th>
            <Th>{t("orders.region")}</Th>
            <Th>{t("orders.district")}</Th>
            <Th>{t("orders.mahalla")}</Th>
            <Th>{t("orders.total")}</Th>
            <Th>{t("common.actions")}</Th>
          </tr>
        </Thead>
        <Tbody>
          {customer.orders.map((o) => (
            <tr key={o.id}>
              <Td>{new Date(o.createdAt).toLocaleString()}</Td>
              <Td>
                <Badge color={STATUS_COLORS[o.status]}>{t(STATUS_LABEL_KEYS[o.status])}</Badge>
              </Td>
              <Td>{regionName(o.addressRegion)}</Td>
              <Td>{districtName(o.addressRegion, o.addressDistrict)}</Td>
              <Td>{o.addressMahalla ?? "—"}</Td>
              <Td>{o.totalAmount.toLocaleString()}</Td>
              <Td>
                <Link to={`/orders/${o.id}`} className="text-brand-600 hover:underline">
                  {t("common.edit")}
                </Link>
              </Td>
            </tr>
          ))}
          {customer.orders.length === 0 && (
            <tr>
              <Td colSpan={7} className="text-center text-gray-400">
                {t("common.noData")}
              </Td>
            </tr>
          )}
        </Tbody>
      </Table>
    </div>
  );
}
