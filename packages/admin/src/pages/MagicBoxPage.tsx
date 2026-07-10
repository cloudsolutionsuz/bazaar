import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as magicBoxApi from "../api/magicBoxes";
import * as productsApi from "../api/products";
import type { MagicBox } from "../api/magicBoxes";
import type { Product } from "../types/api";

const MAGIC_BOX_SVG = (
  <svg width="48" height="48" viewBox="0 0 100 100" fill="none">
    <rect x="10" y="45" width="80" height="48" rx="6" fill="#facc15" />
    <rect x="10" y="35" width="80" height="14" rx="4" fill="#f59e0b" />
    <rect x="44" y="35" width="12" height="58" fill="#ef4444" />
    <path d="M50 35 C50 35 35 20 30 22 C25 24 30 35 50 35" fill="#ef4444" />
    <path d="M50 35 C50 35 65 20 70 22 C75 24 70 35 50 35" fill="#ef4444" />
    <text x="50" y="78" textAnchor="middle" fontSize="28" fontWeight="900" fontFamily="Arial" fill="white">?</text>
  </svg>
);

interface RequiredItemRow {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
}

function MagicBoxForm({
  initial,
  products,
  onSave,
  onCancel,
}: {
  initial?: MagicBox;
  products: Product[];
  onSave: (data: { name: string; description: string; items: { variantId: string; quantity: number }[] }) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [rows, setRows] = useState<RequiredItemRow[]>(
    initial?.items.map((i) => ({
      id: i.id,
      productId: i.variant.product.id,
      variantId: i.variantId,
      quantity: i.quantity,
    })) ?? [{ id: crypto.randomUUID(), productId: "", variantId: "", quantity: 1 }],
  );

  function addRow() {
    setRows((r) => [...r, { id: crypto.randomUUID(), productId: "", variantId: "", quantity: 1 }]);
  }

  function removeRow(id: string) {
    setRows((r) => r.filter((row) => row.id !== id));
  }

  function updateRow(id: string, patch: Partial<RequiredItemRow>) {
    setRows((r) => r.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function handleSubmit() {
    const items = rows.filter((r) => r.variantId && r.quantity > 0).map((r) => ({ variantId: r.variantId, quantity: r.quantity }));
    if (!name.trim() || items.length === 0) return;
    onSave({ name: name.trim(), description: description.trim(), items });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{t("magicBox.name")}</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{t("magicBox.description")}</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
      </div>

      <div>
        <div className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">{t("magicBox.requiredItems")}</div>
        <div className="space-y-2">
          {rows.map((row) => {
            const product = products.find((p) => p.id === row.productId);
            return (
              <div key={row.id} className="flex items-center gap-2">
                <select
                  value={row.productId}
                  onChange={(e) => updateRow(row.id, { productId: e.target.value, variantId: "" })}
                  className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                >
                  <option value="">{t("magicBox.selectProduct")}</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <select
                  value={row.variantId}
                  onChange={(e) => updateRow(row.id, { variantId: e.target.value })}
                  disabled={!product}
                  className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 disabled:opacity-50"
                >
                  <option value="">{t("magicBox.selectVariant")}</option>
                  {product?.variants.map((v) => (
                    <option key={v.id} value={v.id}>{v.name ?? v.sku}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={row.quantity}
                  onChange={(e) => updateRow(row.id, { quantity: Number(e.target.value) })}
                  className="w-16 rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
                <span className="text-xs text-gray-500">{t("magicBox.pcs")}</span>
                {rows.length > 1 && (
                  <button onClick={() => removeRow(row.id)} className="text-xs text-red-500 hover:underline">{t("common.delete")}</button>
                )}
              </div>
            );
          })}
        </div>
        <button onClick={addRow} className="mt-2 text-sm text-brand-600 hover:underline dark:text-brand-400">
          + {t("magicBox.addItem")}
        </button>
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-md border border-gray-300 px-4 py-2 text-sm dark:border-gray-600 dark:text-gray-300">
          {t("common.cancel")}
        </button>
        <button
          onClick={handleSubmit}
          disabled={!name.trim() || rows.every((r) => !r.variantId)}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {t("common.save")}
        </button>
      </div>
    </div>
  );
}

export function MagicBoxPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const boxesQuery = useQuery({ queryKey: ["magic-boxes"], queryFn: magicBoxApi.listMagicBoxes });
  const productsQuery = useQuery({
    queryKey: ["products-all"],
    queryFn: () => productsApi.listProducts({ pageSize: 200 }),
  });
  const boxes = boxesQuery.data?.items ?? [];
  const products = productsQuery.data?.items ?? [];

  const createMut = useMutation({
    mutationFn: magicBoxApi.createMagicBox,
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["magic-boxes"] }); setCreating(false); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof magicBoxApi.updateMagicBox>[1] }) =>
      magicBoxApi.updateMagicBox(id, data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["magic-boxes"] }); setEditingId(null); },
  });

  const deleteMut = useMutation({
    mutationFn: magicBoxApi.deleteMagicBox,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["magic-boxes"] }),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t("magicBox.title")}</h1>
        {!creating && (
          <button onClick={() => setCreating(true)} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            + {t("magicBox.create")}
          </button>
        )}
      </div>

      {creating && (
        <div className="mb-6 rounded-xl border border-yellow-300 bg-yellow-50 p-5 dark:border-yellow-700 dark:bg-yellow-900/20">
          <h2 className="mb-4 font-semibold text-gray-800 dark:text-gray-100">{t("magicBox.newBox")}</h2>
          <MagicBoxForm
            products={products}
            onSave={(data) => createMut.mutate(data)}
            onCancel={() => setCreating(false)}
          />
        </div>
      )}

      {boxes.length === 0 && !creating ? (
        <p className="text-gray-500">{t("common.noData")}</p>
      ) : (
        <div className="space-y-4">
          {boxes.map((box) => (
            <div key={box.id} className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
              {editingId === box.id ? (
                <>
                  <h2 className="mb-4 font-semibold text-gray-800 dark:text-gray-100">{t("magicBox.editing")}</h2>
                  <MagicBoxForm
                    initial={box}
                    products={products}
                    onSave={(data) => updateMut.mutate({ id: box.id, data })}
                    onCancel={() => setEditingId(null)}
                  />
                </>
              ) : (
                <div className="flex items-start gap-4">
                  <div className="shrink-0">{MAGIC_BOX_SVG}</div>
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{box.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${box.isActive ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"}`}>
                        {box.isActive ? t("common.active") : t("common.inactive")}
                      </span>
                    </div>
                    {box.description && <p className="mb-2 text-sm text-gray-500">{box.description}</p>}
                    <div className="flex flex-wrap gap-2">
                      {box.items.map((item) => (
                        <span key={item.id} className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                          {item.variant.product.name}{item.variant.name ? ` (${item.variant.name})` : ""} × {item.quantity}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => updateMut.mutate({ id: box.id, data: { isActive: !box.isActive } })}
                      className="text-sm text-gray-600 hover:underline dark:text-gray-400"
                    >
                      {box.isActive ? t("common.deactivate") : t("common.activate")}
                    </button>
                    <button onClick={() => setEditingId(box.id)} className="text-sm text-brand-600 hover:underline dark:text-brand-400">
                      {t("common.edit")}
                    </button>
                    <button
                      onClick={() => { if (window.confirm(t("magicBox.confirmDelete"))) deleteMut.mutate(box.id); }}
                      className="text-sm text-red-600 hover:underline"
                    >
                      {t("common.delete")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
