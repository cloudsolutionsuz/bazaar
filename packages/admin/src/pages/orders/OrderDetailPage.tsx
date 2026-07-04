import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as ordersApi from "../../api/orders";
import { ApiError } from "../../api/client";
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
    <div>
      <Link to="/orders" className="mb-4 inline-block text-sm text-brand-600 hover:underline">
        ← {t("common.back")}
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">
          {order.customerName} — {order.totalAmount.toLocaleString()}
        </h1>
        <Badge color={STATUS_COLORS[order.status]}>{t(STATUS_LABEL_KEYS[order.status])}</Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main content — 2/3 */}
        <div className="space-y-6 lg:col-span-2">
          {/* Order items */}
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="font-semibold text-gray-900">{t("orders.items")}</h2>
            </div>
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
          </div>

          {/* Status history */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 font-semibold text-gray-900">{t("orders.statusHistory")}</h2>
            <ul className="space-y-2 text-sm">
              {order.statusHistory.map((entry) => (
                <li key={entry.id} className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2">
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
          </div>
        </div>

        {/* Sidebar — 1/3 */}
        <div className="space-y-6">
          {/* Customer info */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm">
            <h2 className="mb-4 font-semibold text-gray-900">{t("orders.customer")}</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-gray-500">{t("orders.phone")}</dt>
                <dd className="font-medium">{order.customerPhone}</dd>
              </div>
              {order.additionalPhones.length > 0 && (
                <div>
                  <dt className="text-xs text-gray-500">{t("orders.additionalPhones")}</dt>
                  <dd>{order.additionalPhones.join(", ")}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-gray-500">{t("orders.paymentMethod")}</dt>
                <dd>{order.paymentMethod ?? "—"}</dd>
              </div>
            </dl>
          </div>

          {/* Address */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm">
            <h2 className="mb-4 font-semibold text-gray-900">{t("orders.addressNote")}</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-gray-500">{t("orders.region")}</dt>
                <dd>{regionName(order.addressRegion)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">{t("orders.district")}</dt>
                <dd>{districtName(order.addressRegion, order.addressDistrict)}</dd>
              </div>
              {order.addressMahalla && (
                <div>
                  <dt className="text-xs text-gray-500">{t("orders.mahalla")}</dt>
                  <dd>{order.addressMahalla}</dd>
                </div>
              )}
              {order.addressNote && (
                <div>
                  <dt className="text-xs text-gray-500">{t("orders.addressNote")}</dt>
                  <dd>{order.addressNote}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-gray-500">{t("orders.courier")}</dt>
                <dd>{order.courierName ?? "—"}</dd>
              </div>
            </dl>
          </div>

          {/* Change status */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 font-semibold text-gray-900">{t("orders.changeStatus")}</h2>
            {nextStatuses.length === 0 ? (
              <p className="text-sm text-gray-500">{t("orders.noTransitions")}</p>
            ) : (
              <div className="space-y-3">
                {nextStatuses.includes("SHIPPED") && (
                  <Input
                    value={courierName}
                    onChange={(e) => setCourierName(e.target.value)}
                    placeholder={t("orders.courierPlaceholder")}
                    className="w-full"
                  />
                )}
                <div className="flex flex-wrap gap-2">
                  {nextStatuses.map((s) => (
                    <Button key={s} variant="secondary" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate(s)}>
                      {t(STATUS_LABEL_KEYS[s])}
                    </Button>
                  ))}
                </div>
                {statusMutation.isError && (
                  <p className="text-sm text-red-600">
                    {statusMutation.error instanceof ApiError ? statusMutation.error.message : t("common.error")}
                  </p>
                )}
                {statusMutation.isSuccess && (
                  <p className="text-sm text-green-600">{t("orders.statusChanged")}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
