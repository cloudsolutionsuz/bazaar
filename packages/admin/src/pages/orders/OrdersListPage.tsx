import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import * as ordersApi from "../../api/orders";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { Badge } from "../../components/ui/Badge";
import { Table, Thead, Tbody, Th, Td } from "../../components/ui/Table";
import { downloadBlob } from "../../utils/downloadBlob";
import type { OrderStatus } from "../../types/api";

const STATUS_COLORS: Record<OrderStatus, "blue" | "yellow" | "green" | "red" | "gray"> = {
  NEW: "blue",
  PROCESSING: "yellow",
  SHIPPED: "yellow",
  DELIVERED: "green",
  CANCELLED: "red",
  REFUNDED: "red",
};

const STATUS_LABEL_KEYS: Record<OrderStatus, string> = {
  NEW: "orders.statusNew",
  PROCESSING: "orders.statusProcessing",
  SHIPPED: "orders.statusShipped",
  DELIVERED: "orders.statusDelivered",
  CANCELLED: "orders.statusCancelled",
  REFUNDED: "orders.statusRefunded",
};

export function OrdersListPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["orders", { status, page }],
    queryFn: () => ordersApi.listOrders({ status: status || undefined, page, pageSize: 20 }),
  });

  async function handleExport() {
    const blob = await ordersApi.exportOrders();
    downloadBlob(blob, "orders.xlsx");
  }

  const orders = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pageSize = query.data?.pageSize ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">{t("orders.title")}</h1>
        <Button variant="secondary" onClick={handleExport}>
          {t("common.export")}
        </Button>
      </div>

      <div className="mb-4">
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as OrderStatus | "");
            setPage(1);
          }}
        >
          <option value="">{t("common.all")}</option>
          {Object.entries(STATUS_LABEL_KEYS).map(([value, key]) => (
            <option key={value} value={value}>
              {t(key)}
            </option>
          ))}
        </Select>
      </div>

      <Table>
        <Thead>
          <tr>
            <Th>{t("orders.customer")}</Th>
            <Th>{t("orders.phone")}</Th>
            <Th>{t("orders.date")}</Th>
            <Th>{t("common.status")}</Th>
            <Th>{t("orders.total")}</Th>
            <Th>{t("common.actions")}</Th>
          </tr>
        </Thead>
        <Tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <Td>{o.customerName}</Td>
              <Td>{o.customerPhone}</Td>
              <Td>{new Date(o.createdAt).toLocaleString()}</Td>
              <Td>
                <Badge color={STATUS_COLORS[o.status]}>{t(STATUS_LABEL_KEYS[o.status])}</Badge>
              </Td>
              <Td>{o.totalAmount.toLocaleString()}</Td>
              <Td>
                <Link to={`/orders/${o.id}`} className="text-brand-600 hover:underline">
                  {t("common.edit")}
                </Link>
              </Td>
            </tr>
          ))}
          {orders.length === 0 && (
            <tr>
              <Td colSpan={6} className="text-center text-gray-400">
                {t("common.noData")}
              </Td>
            </tr>
          )}
        </Tbody>
      </Table>

      <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
        <span>
          {t("common.page")} {page} / {totalPages}
        </span>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ←
          </Button>
          <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            →
          </Button>
        </div>
      </div>
    </div>
  );
}

export { STATUS_COLORS, STATUS_LABEL_KEYS };
