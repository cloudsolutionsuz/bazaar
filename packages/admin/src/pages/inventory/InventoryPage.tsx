import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as inventoryApi from "../../api/inventory";
import * as productsApi from "../../api/products";
import * as suppliersApi from "../../api/suppliers";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { NumberInput } from "../../components/ui/NumberInput";
import { Select } from "../../components/ui/Select";
import { Badge } from "../../components/ui/Badge";
import { Table, Thead, Tbody, Th, Td } from "../../components/ui/Table";
import { downloadBlob } from "../../utils/downloadBlob";
import { todayInputValue } from "../../utils/dateInput";
import type { InventoryMovementType } from "../../types/api";

type Tab = "lowStock" | "receipt" | "writeOff" | "supplierReturn" | "stocktake" | "stockReport" | "history";

const MOVEMENT_LABEL_KEYS: Record<InventoryMovementType, string> = {
  RECEIPT: "inventory.typeReceipt",
  SALE: "inventory.typeSale",
  RETURN: "inventory.typeReturn",
  ADJUSTMENT: "inventory.typeAdjustment",
  WRITE_OFF: "inventory.typeWriteOff",
  STOCKTAKE: "inventory.typeStocktake",
  SUPPLIER_RETURN: "inventory.typeSupplierReturn",
};

const MOVEMENT_COLORS: Record<InventoryMovementType, "green" | "red" | "blue" | "gray" | "yellow"> = {
  RECEIPT: "green",
  SALE: "red",
  RETURN: "blue",
  ADJUSTMENT: "gray",
  WRITE_OFF: "red",
  STOCKTAKE: "yellow",
  SUPPLIER_RETURN: "blue",
};

export function InventoryPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("lowStock");

  const tabClass = (active: boolean) =>
    `rounded-md px-3 py-2 text-sm font-medium ${active ? "bg-brand-50 text-brand-700" : "text-gray-600 hover:bg-gray-100"}`;

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-gray-900">{t("inventory.title")}</h1>

      <div className="mb-4 flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        <button className={tabClass(tab === "lowStock")} onClick={() => setTab("lowStock")}>
          {t("inventory.tabLowStock")}
        </button>
        <button className={tabClass(tab === "receipt")} onClick={() => setTab("receipt")}>
          {t("inventory.tabReceipt")}
        </button>
        <button className={tabClass(tab === "writeOff")} onClick={() => setTab("writeOff")}>
          {t("inventory.tabWriteOff")}
        </button>
        <button className={tabClass(tab === "supplierReturn")} onClick={() => setTab("supplierReturn")}>
          {t("inventory.tabSupplierReturn")}
        </button>
        <button className={tabClass(tab === "stocktake")} onClick={() => setTab("stocktake")}>
          {t("inventory.tabStocktake")}
        </button>
        <button className={tabClass(tab === "stockReport")} onClick={() => setTab("stockReport")}>
          {t("inventory.tabStockReport")}
        </button>
        <button className={tabClass(tab === "history")} onClick={() => setTab("history")}>
          {t("inventory.tabHistory")}
        </button>
      </div>

      {tab === "lowStock" && <LowStockTab />}
      {tab === "receipt" && <ReceiptTab />}
      {tab === "writeOff" && <WriteOffTab />}
      {tab === "supplierReturn" && <SupplierReturnTab />}
      {tab === "stocktake" && <StocktakeTab />}
      {tab === "stockReport" && <StockReportTab />}
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
  const query = useQuery({
    queryKey: ["products", "for-select"],
    queryFn: () => productsApi.listProducts({ pageSize: 100 }),
  });
  const products = query.data?.items ?? [];
  const options = products.flatMap((p) =>
    p.variants.map((v) => ({ id: v.id, label: `${p.name} — ${v.name ?? v.sku} (${v.sku})`, stockQuantity: v.stockQuantity })),
  );
  return { options };
}

function ReceiptTab() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { options } = useVariantOptions();
  const suppliersQuery = useQuery({ queryKey: ["suppliers", "for-select"], queryFn: () => suppliersApi.listSuppliers({ pageSize: 100 }) });

  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [supplierId, setSupplierId] = useState("");
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
      supplierId: supplierId || undefined,
      note: note || undefined,
    });
  }

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
        <NumberInput required min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">{t("inventory.purchasePrice")}</label>
        <NumberInput min={1} value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} className="w-full" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">{t("inventory.supplier")}</label>
        <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-full">
          <option value="">{t("inventory.noSupplier")}</option>
          {(suppliersQuery.data?.items ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
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

function WriteOffTab() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { options } = useVariantOptions();

  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: inventoryApi.createWriteOff,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      setQuantity("");
      setUnitCost("");
      setNote("");
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate({
      variantId,
      quantity: Number(quantity),
      unitCost: unitCost ? Number(unitCost) : undefined,
      note,
    });
  }

  const selected = options.find((o) => o.id === variantId);

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
        {selected && <p className="mt-1 text-xs text-gray-500">{t("inventory.currentStock", { count: selected.stockQuantity })}</p>}
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">{t("inventory.quantity")}</label>
        <NumberInput required min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">{t("inventory.unitCost")}</label>
        <NumberInput min={1} value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className="w-full" />
        <p className="mt-1 text-xs text-gray-500">{t("inventory.unitCostHint")}</p>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">{t("inventory.writeOffReason")}</label>
        <Input required value={note} onChange={(e) => setNote(e.target.value)} className="w-full" />
      </div>
      {mutation.isError && <p className="text-sm text-red-600">{(mutation.error as Error).message}</p>}
      <Button type="submit" disabled={mutation.isPending || !variantId}>
        {t("inventory.submitWriteOff")}
      </Button>
    </form>
  );
}

function SupplierReturnTab() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { options } = useVariantOptions();
  const suppliersQuery = useQuery({ queryKey: ["suppliers", "for-select"], queryFn: () => suppliersApi.listSuppliers({ pageSize: 100 }) });

  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: inventoryApi.createSupplierReturn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setQuantity("");
      setUnitCost("");
      setNote("");
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate({
      variantId,
      quantity: Number(quantity),
      supplierId,
      unitCost: Number(unitCost),
      note: note || undefined,
    });
  }

  const selected = options.find((o) => o.id === variantId);

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
        {selected && <p className="mt-1 text-xs text-gray-500">{t("inventory.currentStock", { count: selected.stockQuantity })}</p>}
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">{t("inventory.supplier")}</label>
        <Select required value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-full">
          <option value="" disabled>
            —
          </option>
          {(suppliersQuery.data?.items ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">{t("inventory.quantity")}</label>
        <NumberInput required min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">{t("inventory.unitCost")}</label>
        <NumberInput required min={1} value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className="w-full" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">{t("inventory.note")}</label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} className="w-full" />
      </div>
      {mutation.isError && <p className="text-sm text-red-600">{(mutation.error as Error).message}</p>}
      <Button type="submit" disabled={mutation.isPending || !variantId || !supplierId}>
        {t("inventory.submitSupplierReturn")}
      </Button>
    </form>
  );
}

function StocktakeTab() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { options } = useVariantOptions();

  const [variantId, setVariantId] = useState("");
  const [actualQuantity, setActualQuantity] = useState("");
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: inventoryApi.createStocktake,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setActualQuantity("");
      setNote("");
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate({ variantId, actualQuantity: Number(actualQuantity), note: note || undefined });
  }

  const selected = options.find((o) => o.id === variantId);

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
        {selected && <p className="mt-1 text-xs text-gray-500">{t("inventory.systemStock", { count: selected.stockQuantity })}</p>}
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">{t("inventory.actualQuantity")}</label>
        <NumberInput required min={0} value={actualQuantity} onChange={(e) => setActualQuantity(e.target.value)} className="w-full" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">{t("inventory.note")}</label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} className="w-full" />
      </div>
      <Button type="submit" disabled={mutation.isPending || !variantId}>
        {t("inventory.submitStocktake")}
      </Button>
    </form>
  );
}

function StockReportTab() {
  const { t } = useTranslation();
  const [date, setDate] = useState(todayInputValue());

  const query = useQuery({
    queryKey: ["inventory", "daily-report", date],
    queryFn: () => inventoryApi.getDailyReport(date),
  });

  const rows = query.data?.rows ?? [];

  async function handleExport() {
    const blob = await inventoryApi.exportInventory();
    downloadBlob(blob, "inventory.xlsx");
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-gray-500">{t("reports.from")}</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <Button variant="secondary" onClick={handleExport}>
          {t("common.export")}
        </Button>
      </div>

      <Table>
        <Thead>
          <tr>
            <Th>{t("products.name")}</Th>
            <Th>{t("products.sku")}</Th>
            <Th>{t("inventory.openingStock")}</Th>
            <Th>{t("inventory.typeReceipt")}</Th>
            <Th>{t("inventory.typeSale")}</Th>
            <Th>{t("inventory.typeWriteOff")}</Th>
            <Th>{t("inventory.supplierReturns")}</Th>
            <Th>{t("inventory.closingStock")}</Th>
            <Th>{t("inventory.actualStock")}</Th>
          </tr>
        </Thead>
        <Tbody>
          {rows.map((r) => (
            <tr key={r.variantId}>
              <Td>{r.productName}</Td>
              <Td>{r.sku}</Td>
              <Td>{r.openingStock}</Td>
              <Td>{r.receipts}</Td>
              <Td>{r.sales}</Td>
              <Td>{r.writeOffs}</Td>
              <Td>{r.supplierReturns}</Td>
              <Td className="font-medium">{r.closingStock}</Td>
              <Td>{r.actualStock ?? "—"}</Td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <Td colSpan={9} className="text-center text-gray-400">
                {t("common.noData")}
              </Td>
            </tr>
          )}
        </Tbody>
      </Table>
    </div>
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
          {Object.entries(MOVEMENT_LABEL_KEYS).map(([value, key]) => (
            <option key={value} value={value}>
              {t(key)}
            </option>
          ))}
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
            <Th>{t("inventory.supplier")}</Th>
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
              <Td>{m.supplier?.name ?? "—"}</Td>
              <Td>{m.note ?? "—"}</Td>
            </tr>
          ))}
          {movements.length === 0 && (
            <tr>
              <Td colSpan={8} className="text-center text-gray-400">
                {t("common.noData")}
              </Td>
            </tr>
          )}
        </Tbody>
      </Table>
    </div>
  );
}
