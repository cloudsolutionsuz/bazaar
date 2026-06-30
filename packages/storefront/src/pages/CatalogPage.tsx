import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import * as storefrontApi from "../api/storefront";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { BannerCarousel } from "../components/BannerCarousel";

const PAGE_SIZE = 24;

export function CatalogPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brand, setBrand] = useState("");
  const [discountedOnly, setDiscountedOnly] = useState(false);
  const [promotedOnly, setPromotedOnly] = useState(false);
  const [sort, setSort] = useState<"newest" | "price_asc" | "price_desc">("newest");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);
  const debouncedMinPrice = useDebouncedValue(minPrice);
  const debouncedMaxPrice = useDebouncedValue(maxPrice);

  const metaQuery = useQuery({ queryKey: ["tenant-meta"], queryFn: storefrontApi.getMeta });
  const accentStyle = metaQuery.data?.themeColor ? { backgroundColor: metaQuery.data.themeColor } : undefined;

  const categoriesQuery = useQuery({ queryKey: ["categories"], queryFn: storefrontApi.listCategories });
  const brandsQuery = useQuery({ queryKey: ["brands"], queryFn: storefrontApi.listBrands });
  const productsQuery = useQuery({
    queryKey: [
      "products",
      { search: debouncedSearch, categoryId, brand, discountedOnly, promotedOnly, sort, minPrice: debouncedMinPrice, maxPrice: debouncedMaxPrice, page },
    ],
    queryFn: () =>
      storefrontApi.listProducts({
        search: debouncedSearch || undefined,
        categoryId: categoryId || undefined,
        brand: brand || undefined,
        discountedOnly: discountedOnly || undefined,
        promotedOnly: promotedOnly || undefined,
        sort,
        minPrice: debouncedMinPrice ? Number(debouncedMinPrice) : undefined,
        maxPrice: debouncedMaxPrice ? Number(debouncedMaxPrice) : undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
  });

  const products = productsQuery.data?.items ?? [];
  const total = productsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const noFiltersActive = categoryId === "" && brand === "" && !discountedOnly && !promotedOnly;

  function resetToFirstPage() {
    setPage(1);
  }

  function resetAllFilters() {
    setCategoryId("");
    setBrand("");
    setDiscountedOnly(false);
    setPromotedOnly(false);
    resetToFirstPage();
  }

  return (
    <div>
      <BannerCarousel />
      <input
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          resetToFirstPage();
        }}
        placeholder={t("catalog.searchPlaceholder")}
        className="mb-4 w-full rounded-lg border border-clay-200 bg-white px-4 py-3 text-sm focus:border-clay-500 focus:outline-none"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={resetAllFilters}
          style={noFiltersActive ? accentStyle : undefined}
          className={`rounded-full px-3 py-1 text-sm ${noFiltersActive ? "bg-clay-600 text-white" : "bg-clay-100 text-clay-700"}`}
        >
          {t("common.all")}
        </button>
        {categoriesQuery.data?.categories.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              setCategoryId(c.id);
              resetToFirstPage();
            }}
            style={categoryId === c.id ? accentStyle : undefined}
            className={`rounded-full px-3 py-1 text-sm ${categoryId === c.id ? "bg-clay-600 text-white" : "bg-clay-100 text-clay-700"}`}
          >
            {c.name}
          </button>
        ))}
        <button
          onClick={() => {
            setDiscountedOnly((v) => !v);
            resetToFirstPage();
          }}
          style={discountedOnly ? accentStyle : undefined}
          className={`rounded-full px-3 py-1 text-sm ${discountedOnly ? "bg-clay-600 text-white" : "bg-clay-100 text-clay-700"}`}
        >
          {t("catalog.filterDiscounted")}
        </button>
        <button
          onClick={() => {
            setPromotedOnly((v) => !v);
            resetToFirstPage();
          }}
          style={promotedOnly ? accentStyle : undefined}
          className={`rounded-full px-3 py-1 text-sm ${promotedOnly ? "bg-clay-600 text-white" : "bg-clay-100 text-clay-700"}`}
        >
          {t("catalog.filterPromoted")}
        </button>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value as typeof sort);
            resetToFirstPage();
          }}
          className="rounded-md border border-clay-200 bg-white px-3 py-2 text-sm text-clay-700"
        >
          <option value="newest">{t("catalog.sortNewest")}</option>
          <option value="price_asc">{t("catalog.sortPriceAsc")}</option>
          <option value="price_desc">{t("catalog.sortPriceDesc")}</option>
        </select>
        {brandsQuery.data && brandsQuery.data.brands.length > 0 && (
          <select
            value={brand}
            onChange={(e) => {
              setBrand(e.target.value);
              resetToFirstPage();
            }}
            className="rounded-md border border-clay-200 bg-white px-3 py-2 text-sm text-clay-700"
          >
            <option value="">{t("catalog.allBrands")}</option>
            {brandsQuery.data.brands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        )}
        <input
          type="number"
          min={0}
          value={minPrice}
          onChange={(e) => {
            setMinPrice(e.target.value);
            resetToFirstPage();
          }}
          placeholder={t("catalog.priceFrom")}
          className="w-24 min-w-0 flex-1 rounded-md border border-clay-200 bg-white px-3 py-2 text-sm focus:border-clay-500 focus:outline-none sm:w-28 sm:flex-none"
        />
        <input
          type="number"
          min={0}
          value={maxPrice}
          onChange={(e) => {
            setMaxPrice(e.target.value);
            resetToFirstPage();
          }}
          placeholder={t("catalog.priceTo")}
          className="w-24 min-w-0 flex-1 rounded-md border border-clay-200 bg-white px-3 py-2 text-sm focus:border-clay-500 focus:outline-none sm:w-28 sm:flex-none"
        />
      </div>

      {products.length === 0 ? (
        <p className="text-gray-500">{t("common.noData")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {products.map((p) => {
            const totalStock = p.variants.reduce((sum, v) => sum + v.stockQuantity, 0);
            const cover = p.images[0]?.url;
            const hasDiscount = !!p.discountPercent && p.discountPercent > 0;
            const discountedPrice = hasDiscount ? Math.round(p.price * (1 - p.discountPercent! / 100)) : p.price;
            return (
              <Link
                key={p.id}
                to={`/products/${p.id}`}
                className="group relative overflow-hidden rounded-xl border border-clay-100 bg-white transition hover:shadow-md"
              >
                {hasDiscount && (
                  <span className="absolute left-2 top-2 z-10 rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                    {t("product.discountPercent", { percent: p.discountPercent })}
                  </span>
                )}
                <div className="flex aspect-square items-center justify-center bg-sand-100">
                  {cover ? (
                    <img src={cover} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-display text-clay-300">Bazaar</span>
                  )}
                </div>
                <div className="p-3">
                  <div className="text-sm font-medium text-gray-900">{p.name}</div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="font-display text-lg font-semibold text-clay-700">
                      {discountedPrice.toLocaleString()} {p.currency}
                    </span>
                    {hasDiscount && (
                      <span className="text-sm text-gray-400 line-through">
                        {p.price.toLocaleString()} {p.currency}
                      </span>
                    )}
                  </div>
                  {totalStock === 0 && <div className="mt-1 text-xs text-red-600">{t("catalog.outOfStock")}</div>}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between text-sm text-clay-700">
          <span>
            {t("catalog.page")} {page} / {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-md bg-clay-100 px-3 py-1.5 text-clay-700 disabled:opacity-30"
            >
              ←
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-md bg-clay-100 px-3 py-1.5 text-clay-700 disabled:opacity-30"
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
