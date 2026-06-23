import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import * as storefrontApi from "../api/storefront";
import { useDebouncedValue } from "../hooks/useDebouncedValue";

export function CatalogPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  const categoriesQuery = useQuery({ queryKey: ["categories"], queryFn: storefrontApi.listCategories });
  const productsQuery = useQuery({
    queryKey: ["products", { search: debouncedSearch, categoryId }],
    queryFn: () =>
      storefrontApi.listProducts({ search: debouncedSearch || undefined, categoryId: categoryId || undefined, pageSize: 50 }),
  });

  const products = productsQuery.data?.items ?? [];

  return (
    <div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("catalog.searchPlaceholder")}
        className="mb-4 w-full rounded-lg border border-clay-200 bg-white px-4 py-3 text-sm focus:border-clay-500 focus:outline-none"
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setCategoryId("")}
          className={`rounded-full px-3 py-1 text-sm ${categoryId === "" ? "bg-clay-600 text-white" : "bg-clay-100 text-clay-700"}`}
        >
          {t("common.all")}
        </button>
        {categoriesQuery.data?.categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategoryId(c.id)}
            className={`rounded-full px-3 py-1 text-sm ${categoryId === c.id ? "bg-clay-600 text-white" : "bg-clay-100 text-clay-700"}`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {products.length === 0 ? (
        <p className="text-gray-500">{t("common.noData")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {products.map((p) => {
            const totalStock = p.variants.reduce((sum, v) => sum + v.stockQuantity, 0);
            const cover = p.images[0]?.url;
            return (
              <Link
                key={p.id}
                to={`/products/${p.id}`}
                className="group overflow-hidden rounded-xl border border-clay-100 bg-white transition hover:shadow-md"
              >
                <div className="flex aspect-square items-center justify-center bg-sand-100">
                  {cover ? (
                    <img src={cover} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-display text-clay-300">Bazaar</span>
                  )}
                </div>
                <div className="p-3">
                  <div className="text-sm font-medium text-gray-900">{p.name}</div>
                  <div className="mt-1 font-display text-lg font-semibold text-clay-700">{p.price.toLocaleString()}</div>
                  {totalStock === 0 && <div className="mt-1 text-xs text-red-600">{t("catalog.outOfStock")}</div>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
