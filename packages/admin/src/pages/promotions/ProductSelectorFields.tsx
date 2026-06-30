import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import * as productsApi from "../../api/products";
import * as categoriesApi from "../../api/categories";
import * as suppliersApi from "../../api/suppliers";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import type { ProductSelector } from "../../api/promotions";

export type SelectorMode = "products" | "category" | "brand" | "supplier";

export interface SelectorState {
  mode: SelectorMode;
  productIds: string[];
  categoryId: string;
  brand: string;
  supplierId: string;
  search: string;
}

export function emptySelectorState(): SelectorState {
  return { mode: "products", productIds: [], categoryId: "", brand: "", supplierId: "", search: "" };
}

export function selectorToPayload(s: SelectorState): ProductSelector {
  if (s.mode === "products") return { productIds: s.productIds };
  if (s.mode === "category") return { categoryId: s.categoryId };
  if (s.mode === "brand") return { brand: s.brand };
  return { supplierId: s.supplierId };
}

export function isSelectorValid(s: SelectorState): boolean {
  if (s.mode === "products") return s.productIds.length > 0;
  if (s.mode === "category") return !!s.categoryId;
  if (s.mode === "brand") return s.brand.trim().length > 0;
  return !!s.supplierId;
}

interface Props {
  value: SelectorState;
  onChange: (s: SelectorState) => void;
}

export function ProductSelectorFields({ value, onChange }: Props) {
  const { t } = useTranslation();
  const productsQuery = useQuery({
    queryKey: ["products", "selector", value.search],
    queryFn: () => productsApi.listProducts({ search: value.search || undefined, pageSize: 50 }),
    enabled: value.mode === "products",
  });
  const categoriesQuery = useQuery({ queryKey: ["categories"], queryFn: categoriesApi.listCategories, enabled: value.mode === "category" });
  const suppliersQuery = useQuery({
    queryKey: ["suppliers", "all"],
    queryFn: () => suppliersApi.listSuppliers({ pageSize: 100 }),
    enabled: value.mode === "supplier",
  });

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {(["products", "category", "brand", "supplier"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onChange({ ...value, mode: m })}
            className={`rounded px-2 py-1 text-xs font-medium ${
              value.mode === m ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {t(`promotions.selectorMode.${m}`)}
          </button>
        ))}
      </div>

      {value.mode === "products" && (
        <div>
          <Input
            placeholder={t("products.searchPlaceholder")}
            value={value.search}
            onChange={(e) => onChange({ ...value, search: e.target.value })}
            className="mb-2 w-full"
          />
          <div className="max-h-48 overflow-y-auto rounded-md border border-gray-200">
            {productsQuery.data?.items.map((p) => (
              <label key={p.id} className="flex items-center gap-2 px-2 py-1 text-sm hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={value.productIds.includes(p.id)}
                  onChange={() => {
                    const next = value.productIds.includes(p.id)
                      ? value.productIds.filter((id) => id !== p.id)
                      : [...value.productIds, p.id];
                    onChange({ ...value, productIds: next });
                  }}
                />
                {p.name}
              </label>
            ))}
            {productsQuery.data?.items.length === 0 && <p className="px-2 py-2 text-sm text-gray-400">{t("common.noData")}</p>}
          </div>
          <p className="mt-1 text-xs text-gray-500">{t("promotions.selectedCount", { count: value.productIds.length })}</p>
        </div>
      )}

      {value.mode === "category" && (
        <Select value={value.categoryId} onChange={(e) => onChange({ ...value, categoryId: e.target.value })} className="w-full">
          <option value="">{t("products.noCategory")}</option>
          {categoriesQuery.data?.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      )}

      {value.mode === "brand" && (
        <Input value={value.brand} onChange={(e) => onChange({ ...value, brand: e.target.value })} placeholder={t("products.brand")} className="w-full" />
      )}

      {value.mode === "supplier" && (
        <Select value={value.supplierId} onChange={(e) => onChange({ ...value, supplierId: e.target.value })} className="w-full">
          <option value="">{t("products.noSupplier")}</option>
          {suppliersQuery.data?.items.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}
