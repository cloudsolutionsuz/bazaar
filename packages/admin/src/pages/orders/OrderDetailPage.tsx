import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as ordersApi from "../../api/orders";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { Table, Thead, Tbody, Th, Td } from "../../components/ui/Table";
import { STATUS_COLORS, STATUS_LABEL_KEYS } from "./OrdersListPage";
import { regionName, districtName } from "../../utils/addressLabels";
import type { OrderStatus } from "../../types/api";

export function OrderDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [courierName, setCourierName] = useState("");

  const query = useQuery({
    queryKey: ["order", id],
    queryFn: () => ordersApi.getOrder(id as string),
  });

  const statusMutation = useMutation({
    mutationFn: (status: OrderStatus) => ordersApi.updateOrderStatus(id as string, status, courierName || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const order = query.data?.order;
  if (!order) return null;

  const nextStatuses = ordersApi.ORDER_STATUS_TRANSITIONS[order.status];

  return (
    <div className="max-w-3xl">
      <Link to="/orders" className="mb-4 inline-block text-sm text-brand-600 hover:underline">
        ← {t("common.back")}
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">
          {order.customerName} — {order.totalAmount.toLocaleString()}
        </h1>
        <Badge color={STATUS_COLORS[order.status]}>{t(STATUS_LABEL_KEYS[order.status])}</Badge>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 rounded-xl border border-gray-200 bg-white p-6 text-sm">
        <div>
          <div className="text-gray-500">{t("orders.phone")}</div>
          <div>{order.customerPhone}</div>
        </div>
        <div>
          <div className="text-gray-500">{t("orders.additionalPhones")}</div>
          <div>{order.additionalPhones.length > 0 ? order.additionalPhones.join(", ") : "—"}</div>
        </div>
        <div>
          <div className="text-gray-500">{t("orders.paymentMethod")}</div>
          <div>{order.paymentMethod ?? "—"}</div>
        </div>
        <div>
          <div className="text-gray-500">{t("orders.region")}</div>
          <div>{regionName(order.addressRegion)}</div>
        </div>
        <div>
          <div className="text-gray-500">{t("orders.district")}</div>
          <div>{districtName(order.addressRegion, order.addressDistrict)}</div>
        </div>
        <div>
          <div className="text-gray-500">{t("orders.mahalla")}</div>
          <div>{order.addressMahalla ?? "—"}</div>
        </div>
        <div>
          <div className="text-gray-500">{t("orders.courier")}</div>
          <div>{order.courierName ?? "—"}</div>
        </div>
        <div className="col-span-2">
          <div className="text-gray-500">{t("orders.addressNote")}</div>
          <div>{order.addressNote ?? "—"}</div>
        </div>
      </div>

      <section className="mb-6">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">{t("orders.items")}</h2>
        <Table>
          <Thead>
            <tr>
              <Th>{t("products.name")}</Th>
              <Th>{t("products.sku")}</Th>
              <Th>{t("inventory.quantity")}</Th>
              <Th>{t("products.price")}</Th>
              <Th>{t("orders.total")}</Th>
            </tr>
          </Thead>
          <Tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <Td>{item.variant.product.name}</Td>
                <Td>{item.variant.sku}</Td>
                <Td>{item.quantity}</Td>
                <Td>{item.unitPrice.toLocaleString()}</Td>
                <Td>{item.totalPrice.toLocaleString()}</Td>
              </tr>
            ))}
          </Tbody>
        </Table>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">{t("orders.changeStatus")}</h2>
        {nextStatuses.length === 0 ? (
          <p className="text-sm text-gray-500">{t("orders.noTransitions")}</p>
        ) : (
          <div className="space-y-3">
            {nextStatuses.includes("SHIPPED") && (
              <Input
                value={courierName}
                onChange={(e) => setCourierName(e.target.value)}
                placeholder={t("orders.courierPlaceholder")}
                className="max-w-xs"
              />
            )}
            <div className="flex gap-2">
              {nextStatuses.map((s) => (
                <Button key={s} variant="secondary" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate(s)}>
                  {t(STATUS_LABEL_KEYS[s])}
                </Button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">{t("orders.statusHistory")}</h2>
        <ul className="space-y-2 text-sm">
          {order.statusHistory.map((entry) => (
            <li key={entry.id} className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2">
              <span className="text-gray-400">{new Date(entry.createdAt).toLocaleString()}</span>
              {entry.fromStatus && (
                <>
                  <Badge color={STATUS_COLORS[entry.fromStatus]}>{t(STATUS_LABEL_KEYS[entry.fromStatus])}</Badge>
                  <span>→</span>
                </>
              )}
              <Badge color={STATUS_COLORS[entry.toStatus]}>{t(STATUS_LABEL_KEYS[entry.toStatus])}</Badge>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
