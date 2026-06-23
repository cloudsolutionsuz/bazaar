import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as inventoryApi from "../../api/inventory";
import * as productsApi from "../../api/products";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Badge } from "../../components/ui/Badge";
import { Table, Thead, Tbody, Th, Td } from "../../components/ui/Table";
import type { InventoryMovementType } from "../../types/api";

type Tab = "lowStock" | "receipt" | "history";

const MOVEMENT_LABEL_KEYS: Record<InventoryMovementType, string> = {
  RECEIPT: "inventory.typeReceipt",
  SALE: "inventory.typeSale",
  RETURN: "inventory.typeReturn",
  ADJUSTMENT: "inventory.typeAdjustment",
};

const MOVEMENT_COLORS: Record<InventoryMovementType, "green" | "red" | "blue" | "gray"> = {
  RECEIPT: "green",
  SALE: "red",
  RETURN: "blue",
  ADJUSTMENT: "gray",
};

export function InventoryPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("lowStock");

  const tabClass = (active: boolean) =>
    `rounded-md px-3 py-2 text-sm font-medium ${active ? "bg-brand-50 text-brand-700" : "text-gray-600 hover:bg-gray-100"}`;

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-gray-900">{t("inventory.title")}</h1>

      <div className="mb-4 flex gap-2 border-b border-gray-200 pb-2">
        <button className={tabClass(tab === "lowStock")} onClick={() => setTab("lowStock")}>
          {t("inventory.tabLowStock")}
        </button>
        <button className={tabClass(tab === "receipt")} onClick={() => setTab("receipt")}>
          {t("inventory.tabReceipt")}
        </button>
        <button className={tabClass(tab === "history")} onClick={() => setTab("history")}>
          {t("inventory.tabHistory")}
        </button>
      </div>

      {tab === "lowStock" && <LowStockTab />}
      {tab === "receipt" && <ReceiptTab />}
      {tab === "history" && <HistoryTab />}
    </div>
  );
}

function LowStockTab() {
  const { t } = useTranslation();
  const query = useQuery({ queryKey: ["inventory", "lowStock"], queryFn: inventoryApi.listLowStock });
  const variants = query.data?.variants ?? [];

  return (
    <Table>
      <Thead>
        <tr>
          <Th>{t("products.name")}</Th>
          <Th>{t("products.variantName")}</Th>
          <Th>{t("products.sku")}</Th>
          <Th>{t("products.stock")}</Th>
          <Th>{t("products.lowStockThreshold")}</Th>
        </tr>
      </Thead>
      <Tbody>
        {variants.map((v) => (
          <tr key={v.id}>
            <Td>{v.product.name}</Td>
            <Td>{v.name ?? "—"}</Td>
            <Td>{v.sku}</Td>
            <Td className="font-medium text-red-600">{v.stockQuantity}</Td>
            <Td>{v.lowStockThreshold}</Td>
          </tr>
        ))}
        {variants.length === 0 && (
          <tr>
            <Td colSpan={5} className="text-center text-gray-400">
              {t("inventory.noLowStock")}
            </Td>
          </tr>
        )}
      </Tbody>
    </Table>
  );
}

function useVariantOptions() {
  return useQuery({
    queryKey: ["products", "for-select"],
    queryFn: () => productsApi.listProducts({ pageSize: 100 }),
  });
}

function ReceiptTab() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const productsQuery = useVariantOptions();

  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: inventoryApi.createReceipt,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setQuantity("");
      setPurchasePrice("");
      setNote("");
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate({
      variantId,
      quantity: Number(quantity),
      purchasePrice: purchasePrice ? Number(purchasePrice) : undefined,
      note: note || undefined,
    });
  }

  const options = (productsQuery.data?.items ?? []).flatMap((p) =>
    p.variants.map((v) => ({ id: v.id, label: `${p.name} — ${v.name ?? v.sku} (${v.sku})` })),
  );

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4 rounded-xl border border-gray-200 bg-white p-6">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">{t("inventory.variant")}</label>
        <Select required value={variantId} onChange={(e) => setVariantId(e.target.value)} className="w-full">
          <option value="" disabled>
            —
          </option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">{t("inventory.quantity")}</label>
        <Input required type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">{t("inventory.purchasePrice")}</label>
        <Input type="number" min={1} value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} className="w-full" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">{t("inventory.note")}</label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} className="w-full" />
      </div>
      <Button type="submit" disabled={mutation.isPending || !variantId}>
        {t("inventory.submitReceipt")}
      </Button>
    </form>
  );
}

function HistoryTab() {
  const { t } = useTranslation();
  const [type, setType] = useState<InventoryMovementType | "">("");

  const query = useQuery({
    queryKey: ["inventory", "movements", { type }],
    queryFn: () => inventoryApi.listMovements({ type: type || undefined, pageSize: 50 }),
  });

  const movements = query.data?.items ?? [];

  return (
    <div>
      <div className="mb-4">
        <Select value={type} onChange={(e) => setType(e.target.value as InventoryMovementType | "")}>
          <option value="">{t("common.all")}</option>
          <option value="RECEIPT">{t("inventory.typeReceipt")}</option>
          <option value="SALE">{t("inventory.typeSale")}</option>
          <option value="RETURN">{t("inventory.typeReturn")}</option>
          <option value="ADJUSTMENT">{t("inventory.typeAdjustment")}</option>
        </Select>
      </div>

      <Table>
        <Thead>
          <tr>
            <Th>{t("orders.date")}</Th>
            <Th>{t("inventory.movementType")}</Th>
            <Th>{t("products.name")}</Th>
            <Th>{t("products.sku")}</Th>
            <Th>{t("inventory.quantity")}</Th>
            <Th>{t("inventory.purchasePrice")}</Th>
            <Th>{t("inventory.note")}</Th>
          </tr>
        </Thead>
        <Tbody>
          {movements.map((m) => (
            <tr key={m.id}>
              <Td>{new Date(m.createdAt).toLocaleString()}</Td>
              <Td>
                <Badge color={MOVEMENT_COLORS[m.type]}>{t(MOVEMENT_LABEL_KEYS[m.type])}</Badge>
              </Td>
              <Td>{m.variant?.product.name ?? "—"}</Td>
              <Td>{m.variant?.sku ?? "—"}</Td>
              <Td className={m.quantity < 0 ? "text-red-600" : "text-green-600"}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</Td>
              <Td>{m.purchasePrice ?? "—"}</Td>
              <Td>{m.note ?? "—"}</Td>
            </tr>
          ))}
          {movements.length === 0 && (
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
