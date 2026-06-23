import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as productsApi from "../../api/products";
import * as categoriesApi from "../../api/categories";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { VariantsManager } from "./VariantsManager";
import { ImagesManager } from "./ImagesManager";
import { NewVariantsTable, emptyVariantDraft, type VariantDraft } from "./NewVariantsTable";
import type { ProductStatus } from "../../types/api";

export function ProductFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";

  const productQuery = useQuery({
    queryKey: ["product", id],
    queryFn: () => productsApi.getProduct(id as string),
    enabled: !isNew,
  });
  const categoriesQuery = useQuery({ queryKey: ["categories"], queryFn: categoriesApi.listCategories });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState<ProductStatus>("ACTIVE");
  const [newVariantDrafts, setNewVariantDrafts] = useState<VariantDraft[]>([emptyVariantDraft()]);

  useEffect(() => {
    const product = productQuery.data?.product;
    if (product) {
      setName(product.name);
      setDescription(product.description ?? "");
      setPrice(String(product.price));
      setCategoryId(product.categoryId ?? "");
      setStatus(product.status);
    }
  }, [productQuery.data]);

  const createMutation = useMutation({
    mutationFn: productsApi.createProduct,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      navigate(`/products/${data.product.id}`, { replace: true });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (input: productsApi.UpdateProductInput) => productsApi.updateProduct(id as string, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product", id] });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const basePayload = {
      name,
      description: description || undefined,
      price: Number(price),
      categoryId: categoryId || undefined,
      status,
    };

    if (isNew) {
      const variants = newVariantDrafts
        .filter((d) => d.sku.trim())
        .map((d) => ({
          name: d.name || undefined,
          sku: d.sku,
          priceOverride: d.priceOverride ? Number(d.priceOverride) : undefined,
          stockQuantity: d.stockQuantity ? Number(d.stockQuantity) : undefined,
          lowStockThreshold: d.lowStockThreshold ? Number(d.lowStockThreshold) : undefined,
        }));
      createMutation.mutate({ ...basePayload, variants: variants.length > 0 ? variants : undefined });
    } else {
      updateMutation.mutate(basePayload);
    }
  }

  const product = productQuery.data?.product;
  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="max-w-3xl">
      <Link to="/products" className="mb-4 inline-block text-sm text-brand-600 hover:underline">
        ← {t("common.back")}
      </Link>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">{isNew ? t("products.addProduct") : t("products.editProduct")}</h1>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("products.name")}</label>
          <Input required value={name} onChange={(e) => setName(e.target.value)} className="w-full" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("products.description")}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            rows={3}
          />
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-gray-700">{t("products.price")}</label>
            <Input required type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} className="w-full" />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-gray-700">{t("products.category")}</label>
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full">
              <option value="">{t("products.noCategory")}</option>
              {categoriesQuery.data?.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-gray-700">{t("common.status")}</label>
            <Select value={status} onChange={(e) => setStatus(e.target.value as ProductStatus)} className="w-full">
              <option value="ACTIVE">{t("products.statusActive")}</option>
              <option value="HIDDEN">{t("products.statusHidden")}</option>
              <option value="OUT_OF_STOCK">{t("products.statusOutOfStock")}</option>
            </Select>
          </div>
        </div>

        <Button type="submit" disabled={saving}>
          {t("common.save")}
        </Button>
      </form>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">{t("products.variants")}</h2>
        {isNew ? (
          <NewVariantsTable drafts={newVariantDrafts} onChange={setNewVariantDrafts} />
        ) : (
          product && <VariantsManager productId={product.id} variants={product.variants} />
        )}
      </section>

      {!isNew && product && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">{t("products.images")}</h2>
          <ImagesManager productId={product.id} images={product.images} />
        </section>
      )}
    </div>
  );
}
