import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as ordersApi from "../../api/orders";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { Table, Thead, Tbody, Th, Td } from "../../components/ui/Table";
import { downloadBlob } from "../../utils/downloadBlob";
import { regionName, districtName } from "../../utils/addressLabels";
import type { OrderStatus } from "../../types/api";

export const STATUS_COLORS: Record<OrderStatus, "blue" | "yellow" | "green" | "red" | "gray"> = {
  NEW: "blue",
  PROCESSING: "yellow",
  SHIPPED: "yellow",
  DELIVERED: "green",
  CANCELLED: "red",
  REFUNDED: "red",
  ARCHIVED: "gray",
};

export const STATUS_LABEL_KEYS: Record<OrderStatus, string> = {
  NEW: "orders.statusNew",
  PROCESSING: "orders.statusProcessing",
  SHIPPED: "orders.statusShipped",
  DELIVERED: "orders.statusDelivered",
  CANCELLED: "orders.statusCancelled",
  REFUNDED: "orders.statusRefunded",
  ARCHIVED: "orders.statusArchived",
};

export function productNames(order: { items: { variant?: { product?: { name: string } } | null }[] }): string {
  return [...new Set(order.items.map((i) => i.variant?.product?.name).filter(Boolean))].join(", ") || "—";
}

interface Props {
  archivedOnly?: boolean;
}

export function OrdersListPage({ archivedOnly = false }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({ status: "" as OrderStatus | "", from: "", to: "" });
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<OrderStatus | "">("");
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["orders", { archivedOnly, ...appliedFilters, page }],
    queryFn: () =>
      ordersApi.listOrders({
        status: archivedOnly ? "ARCHIVED" : appliedFilters.status || undefined,
        from: appliedFilters.from ? `${appliedFilters.from}T00:00:00` : undefined,
        to: appliedFilters.to ? `${appliedFilters.to}T23:59:59` : undefined,
        page,
        pageSize: 20,
      }),
  });

  function handleApplyFilters() {
    setAppliedFilters({ status, from, to });
    setPage(1);
  }

  async function handleExport() {
    const blob = await ordersApi.exportOrders();
    downloadBlob(blob, "orders.xlsx");
  }

  const orders = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pageSize = query.data?.pageSize ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function toggleSelectAll() {
    setSelectedIds(selectedIds.length === orders.length ? [] : orders.map((o) => o.id));
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleBulkStatusChange() {
    if (!bulkStatus) return;
    setBulkResult(null);
    const results = await Promise.allSettled(selectedIds.map((id) => ordersApi.updateOrderStatus(id, bulkStatus)));
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    setBulkResult(t("orders.archivedCount", { succeeded, total: selectedIds.length }));
    setSelectedIds([]);
    setBulkStatus("");
    queryClient.invalidateQueries({ queryKey: ["orders"] });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">{archivedOnly ? t("orders.archivedTitle") : t("orders.title")}</h1>
        <div className="flex gap-2">
          {!archivedOnly && (
            <Link to="/orders/archived">
              <Button variant="secondary">{t("orders.viewArchived")}</Button>
            </Link>
          )}
          <Button variant="secondary" onClick={handleExport}>
            {t("common.export")}
          </Button>
        </div>
      </div>

      {!archivedOnly && (
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-gray-500">{t("common.status")}</label>
            <Select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus | "")}>
              <option value="">{t("common.all")}</option>
              {Object.entries(STATUS_LABEL_KEYS)
                .filter(([value]) => value !== "ARCHIVED")
                .map(([value, key]) => (
                  <option key={value} value={value}>
                    {t(key)}
                  </option>
                ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">{t("reports.from")}</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">{t("reports.to")}</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button onClick={handleApplyFilters}>{t("common.apply")}</Button>
          {selectedIds.length > 0 && (
            <div className="flex items-end gap-2">
              <div>
                <label className="mb-1 block text-xs text-gray-500">{t("orders.changeStatus")}</label>
                <Select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value as OrderStatus | "")}>
                  <option value="">{t("common.select")}</option>
                  {Object.entries(STATUS_LABEL_KEYS).map(([value, key]) => (
                    <option key={value} value={value}>
                      {t(key)}
                    </option>
                  ))}
                </Select>
              </div>
              <Button variant="secondary" disabled={!bulkStatus} onClick={handleBulkStatusChange}>
                {t("orders.applyToSelected", { count: selectedIds.length })}
              </Button>
            </div>
          )}
        </div>
      )}

      {bulkResult && <p className="mb-3 text-sm text-gray-600">{bulkResult}</p>}

      <Table>
        <Thead>
          <tr>
            <Th>
              <input
                type="checkbox"
                checked={orders.length > 0 && selectedIds.length === orders.length}
                onChange={toggleSelectAll}
              />
            </Th>
            <Th>{t("orders.customer")}</Th>
            <Th>{t("orders.phone")}</Th>
            <Th>{t("orders.additionalPhones")}</Th>
            <Th>{t("orders.region")}</Th>
            <Th>{t("orders.district")}</Th>
            <Th>{t("orders.mahalla")}</Th>
            <Th>{t("products.name")}</Th>
            <Th>{t("orders.date")}</Th>
            <Th>{t("orders.time")}</Th>
            <Th>{t("common.status")}</Th>
            <Th>{t("orders.items")}</Th>
            <Th>{t("orders.total")}</Th>
            <Th>{t("common.actions")}</Th>
          </tr>
        </Thead>
        <Tbody>
          {orders.map((o) => {
            const created = new Date(o.createdAt);
            return (
              <tr key={o.id}>
                <Td>
                  <input type="checkbox" checked={selectedIds.includes(o.id)} onChange={() => toggleSelect(o.id)} />
                </Td>
                <Td>{o.customerName}</Td>
                <Td>{o.customerPhone}</Td>
                <Td>{o.additionalPhones.length > 0 ? o.additionalPhones.join(", ") : "—"}</Td>
                <Td>{regionName(o.addressRegion)}</Td>
                <Td>{districtName(o.addressRegion, o.addressDistrict)}</Td>
                <Td>{o.addressMahalla ?? "—"}</Td>
                <Td>{productNames(o)}</Td>
                <Td>{created.toLocaleDateString()}</Td>
                <Td>{created.toLocaleTimeString()}</Td>
                <Td>
                  <Badge color={STATUS_COLORS[o.status]}>{t(STATUS_LABEL_KEYS[o.status])}</Badge>
                </Td>
                <Td>{t("orders.itemsCount", { count: o.items.length })}</Td>
                <Td>{o.totalAmount.toLocaleString()}</Td>
                <Td>
                  <Link to={`/orders/${o.id}`} className="text-brand-600 hover:underline">
                    {t("common.edit")}
                  </Link>
                </Td>
              </tr>
            );
          })}
          {orders.length === 0 && (
            <tr>
              <Td colSpan={14} className="text-center text-gray-400">
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
