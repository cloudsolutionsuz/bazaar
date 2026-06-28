import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as productsApi from "../../api/products";
import { Button } from "../../components/ui/Button";
import { Table, Thead, Tbody, Th, Td } from "../../components/ui/Table";
import { VariantFormModal, emptyVariantFormValues, type VariantFormValues } from "./VariantFormModal";
import type { ProductVariant } from "../../types/api";

function toFormValues(variant: ProductVariant): VariantFormValues {
  return {
    name: variant.name ?? "",
    sku: variant.sku,
    priceOverride: variant.priceOverride ? String(variant.priceOverride) : "",
    stockQuantity: String(variant.stockQuantity),
    lowStockThreshold: variant.lowStockThreshold ? String(variant.lowStockThreshold) : "",
  };
}

function toUpdateInput(values: VariantFormValues): productsApi.UpdateVariantInput {
  return {
    name: values.name || undefined,
    priceOverride: values.priceOverride ? Number(values.priceOverride) : undefined,
    lowStockThreshold: values.lowStockThreshold ? Number(values.lowStockThreshold) : undefined,
  };
}

function toCreateInput(values: VariantFormValues): productsApi.VariantInput {
  return {
    name: values.name || undefined,
    sku: values.sku,
    priceOverride: values.priceOverride ? Number(values.priceOverride) : undefined,
    stockQuantity: values.stockQuantity ? Number(values.stockQuantity) : undefined,
    lowStockThreshold: values.lowStockThreshold ? Number(values.lowStockThreshold) : undefined,
  };
}

export function VariantsManager({ productId, variants }: { productId: string; variants: ProductVariant[] }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [adding, setAdding] = useState(false);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["product", productId] });
  }

  const createMutation = useMutation({
    mutationFn: (input: productsApi.VariantInput) => productsApi.createVariant(productId, input),
    onSuccess: () => {
      invalidate();
      setAdding(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ variantId, input }: { variantId: string; input: productsApi.UpdateVariantInput }) =>
      productsApi.updateVariant(productId, variantId, input),
    onSuccess: () => {
      invalidate();
      setEditingVariant(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (variantId: string) => productsApi.deleteVariant(productId, variantId),
    onSuccess: invalidate,
  });

  return (
    <div>
      <Table>
        <Thead>
          <tr>
            <Th>{t("products.variantName")}</Th>
            <Th>{t("products.sku")}</Th>
            <Th>{t("products.priceOverride")}</Th>
            <Th>{t("products.stock")}</Th>
            <Th>{t("products.lowStockThreshold")}</Th>
            <Th>{t("common.actions")}</Th>
          </tr>
        </Thead>
        <Tbody>
          {variants.map((v) => (
            <tr key={v.id}>
              <Td>{v.name ?? "—"}</Td>
              <Td>{v.sku}</Td>
              <Td>{v.priceOverride ?? "—"}</Td>
              <Td>
                <span title={t("products.stockReadonlyHint")}>{v.stockQuantity}</span>
              </Td>
              <Td>{v.lowStockThreshold ?? "—"}</Td>
              <Td>
                <div className="flex gap-3">
                  <button onClick={() => setEditingVariant(v)} className="text-brand-600 hover:underline">
                    {t("common.edit")}
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(t("products.confirmDeleteVariant"))) deleteMutation.mutate(v.id);
                    }}
                    className="text-red-600 hover:underline"
                  >
                    {t("common.delete")}
                  </button>
                </div>
              </Td>
            </tr>
          ))}
        </Tbody>
      </Table>

      <Button type="button" variant="secondary" className="mt-3" onClick={() => setAdding(true)}>
        {t("products.addVariant")}
      </Button>

      <VariantFormModal
        open={adding}
        onClose={() => setAdding(false)}
        initialValues={emptyVariantFormValues()}
        showStock
        skuEditable
        submitting={createMutation.isPending}
        onSubmit={(values) => createMutation.mutate(toCreateInput(values))}
      />

      <VariantFormModal
        open={editingVariant !== null}
        onClose={() => setEditingVariant(null)}
        initialValues={editingVariant ? toFormValues(editingVariant) : emptyVariantFormValues()}
        showStock={false}
        skuEditable={false}
        submitting={updateMutation.isPending}
        onSubmit={(values) => {
          if (editingVariant) updateMutation.mutate({ variantId: editingVariant.id, input: toUpdateInput(values) });
        }}
      />
    </div>
  );
}
