import { useRef, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as productsApi from "../../api/products";
import * as categoriesApi from "../../api/categories";
import * as promotionsApi from "../../api/promotions";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { Table, Thead, Tbody, Th, Td } from "../../components/ui/Table";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { downloadBlob } from "../../utils/downloadBlob";
import { ApiError } from "../../api/client";
import { ProductSelectorFields, emptySelectorState, isSelectorValid, selectorToPayload, type SelectorState } from "../promotions/ProductSelectorFields";
import type { ProductStatus } from "../../types/api";

const STATUS_COLORS: Record<ProductStatus, "green" | "gray" | "red"> = {
  ACTIVE: "green",
  HIDDEN: "gray",
  OUT_OF_STOCK: "red",
};

const STATUS_LABEL_KEYS: Record<ProductStatus, string> = {
  ACTIVE: "products.statusActive",
  HIDDEN: "products.statusHidden",
  OUT_OF_STOCK: "products.statusOutOfStock",
};

export function ProductsListPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ProductStatus | "">("");
  const [categoryId, setCategoryId] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);
  const [discountModalOpen, setDiscountModalOpen] = useState(false);
  const [discountSelector, setDiscountSelector] = useState<SelectorState>(emptySelectorState());
  const [discountValue, setDiscountValue] = useState("");

  const categoriesQuery = useQuery({ queryKey: ["categories"], queryFn: categoriesApi.listCategories });

  const productsQuery = useQuery({
    queryKey: ["products", { search: debouncedSearch, status, categoryId, page }],
    queryFn: () =>
      productsApi.listProducts({
        search: debouncedSearch || undefined,
        status: status || undefined,
        categoryId: categoryId || undefined,
        page,
        pageSize: 20,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productsApi.deleteProduct(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.code === "PRODUCT_HAS_ORDERS") {
        window.alert(t("products.cannotDeleteHasOrders"));
      } else {
        window.alert(err instanceof Error ? err.message : t("common.error"));
      }
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ProductStatus }) => productsApi.updateProduct(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => productsApi.importProducts(file),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      window.alert(t("products.importResult", { created: result.created, errors: result.errors.length }));
    },
  });

  const discountMutation = useMutation({
    mutationFn: (clear: boolean) =>
      promotionsApi.applyBulkDiscount({
        ...selectorToPayload(discountSelector),
        discountPercent: clear ? null : Number(discountValue),
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      window.alert(t("products.discountApplied", { count: result.updated }));
      setDiscountModalOpen(false);
      setDiscountSelector(emptySelectorState());
      setDiscountValue("");
    },
  });

  async function handleExport() {
    const blob = await productsApi.exportProducts();
    downloadBlob(blob, "products.xlsx");
  }

  async function handleDownloadTemplate() {
    const blob = await productsApi.downloadImportTemplate();
    downloadBlob(blob, "products-import-template.xlsx");
  }

  function handleImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) importMutation.mutate(file);
    e.target.value = "";
  }

  const products = productsQuery.data?.items ?? [];
  const total = productsQuery.data?.total ?? 0;
  const pageSize = productsQuery.data?.pageSize ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">{t("products.title")}</h1>
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={handleImportFile} />
          <Button variant="secondary" onClick={handleDownloadTemplate}>
            {t("products.downloadTemplate")}
          </Button>
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
            {t("common.import")}
          </Button>
          <Button variant="secondary" onClick={handleExport}>
            {t("common.export")}
          </Button>
          <Button variant="secondary" onClick={() => setDiscountModalOpen(true)}>
            {t("products.applyDiscount")}
          </Button>
          <Link to="/products/new">
            <Button>{t("products.addProduct")}</Button>
          </Link>
        </div>
      </div>

      <Modal open={discountModalOpen} onClose={() => setDiscountModalOpen(false)} title={t("products.applyDiscount")}>
        <div className="space-y-4">
          <ProductSelectorFields value={discountSelector} onChange={setDiscountSelector} />
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t("products.discount")}, %</label>
            <Input type="number" min={0} max={99} value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} className="w-full" />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={!isSelectorValid(discountSelector) || discountMutation.isPending}
              onClick={() => discountMutation.mutate(true)}
            >
              {t("products.clearDiscount")}
            </Button>
            <Button
              type="button"
              disabled={!isSelectorValid(discountSelector) || !discountValue || discountMutation.isPending}
              onClick={() => discountMutation.mutate(false)}
            >
              {t("common.apply")}
            </Button>
          </div>
        </div>
      </Modal>

      <div className="mb-4 flex gap-3">
        <Input
          placeholder={t("products.searchPlaceholder")}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-64"
        />
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as ProductStatus | "");
            setPage(1);
          }}
        >
          <option value="">{t("common.all")}</option>
          <option value="ACTIVE">{t("products.statusActive")}</option>
          <option value="HIDDEN">{t("products.statusHidden")}</option>
          <option value="OUT_OF_STOCK">{t("products.statusOutOfStock")}</option>
        </Select>
        <Select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">{t("common.all")}</option>
          {categoriesQuery.data?.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <Table>
        <Thead>
          <tr>
            <Th>{t("products.name")}</Th>
            <Th>{t("products.category")}</Th>
            <Th>{t("products.price")}</Th>
            <Th>{t("products.discount")}</Th>
            <Th>{t("products.stock")}</Th>
            <Th>{t("common.status")}</Th>
            <Th>{t("common.actions")}</Th>
          </tr>
        </Thead>
        <Tbody>
          {products.map((p) => {
            const totalStock = p.variants.reduce((sum, v) => sum + v.stockQuantity, 0);
            return (
              <tr key={p.id}>
                <Td>{p.name}</Td>
                <Td>{p.category?.name ?? t("products.noCategory")}</Td>
                <Td>{p.price.toLocaleString()}</Td>
                <Td>{p.discountPercent ? <Badge color="green">-{p.discountPercent}%</Badge> : "—"}</Td>
                <Td>{totalStock}</Td>
                <Td>
                  <Badge color={STATUS_COLORS[p.status]}>{t(STATUS_LABEL_KEYS[p.status])}</Badge>
                </Td>
                <Td>
                  <div className="flex items-center gap-3">
                    <Link to={`/products/${p.id}`} className="text-brand-600 hover:underline">
                      {t("common.edit")}
                    </Link>
                    <select
                      value={p.status}
                      onChange={(e) => statusMutation.mutate({ id: p.id, status: e.target.value as ProductStatus })}
                      className="rounded border border-gray-300 px-1 py-0.5 text-xs"
                    >
                      <option value="ACTIVE">{t("products.statusActive")}</option>
                      <option value="HIDDEN">{t("products.statusHidden")}</option>
                      <option value="OUT_OF_STOCK">{t("products.statusOutOfStock")}</option>
                    </select>
                    <button
                      onClick={() => {
                        if (window.confirm(t("products.confirmDeleteProduct"))) deleteMutation.mutate(p.id);
                      }}
                      className="text-red-600 hover:underline"
                    >
                      {t("common.delete")}
                    </button>
                  </div>
                </Td>
              </tr>
            );
          })}
          {products.length === 0 && (
            <tr>
              <Td colSpan={7} className="text-center text-gray-400">
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
