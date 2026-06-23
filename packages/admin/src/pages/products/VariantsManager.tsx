import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as productsApi from "../../api/products";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Table, Thead, Tbody, Th, Td } from "../../components/ui/Table";
import type { ProductVariant } from "../../types/api";

interface VariantFormState {
  name: string;
  sku: string;
  priceOverride: string;
  lowStockThreshold: string;
}

const EMPTY_FORM: VariantFormState = { name: "", sku: "", priceOverride: "", lowStockThreshold: "" };

export function VariantsManager({ productId, variants }: { productId: string; variants: ProductVariant[] }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<VariantFormState>(EMPTY_FORM);
  const [addingForm, setAddingForm] = useState<VariantFormState | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["product", productId] });
  }

  const createMutation = useMutation({
    mutationFn: (input: productsApi.VariantInput) => productsApi.createVariant(productId, input),
    onSuccess: () => {
      invalidate();
      setAddingForm(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ variantId, input }: { variantId: string; input: productsApi.UpdateVariantInput }) =>
      productsApi.updateVariant(productId, variantId, input),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (variantId: string) => productsApi.deleteVariant(productId, variantId),
    onSuccess: invalidate,
  });

  function startEdit(variant: ProductVariant) {
    setEditingId(variant.id);
    setEditForm({
      name: variant.name ?? "",
      sku: variant.sku,
      priceOverride: variant.priceOverride ? String(variant.priceOverride) : "",
      lowStockThreshold: variant.lowStockThreshold ? String(variant.lowStockThreshold) : "",
    });
  }

  function toVariantInput(form: VariantFormState): productsApi.VariantInput {
    return {
      name: form.name || undefined,
      sku: form.sku,
      priceOverride: form.priceOverride ? Number(form.priceOverride) : undefined,
      lowStockThreshold: form.lowStockThreshold ? Number(form.lowStockThreshold) : undefined,
    };
  }

  function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    const { sku: _sku, ...rest } = toVariantInput(editForm);
    updateMutation.mutate({ variantId: editingId, input: rest });
  }

  function handleAddSubmit(e: FormEvent) {
    e.preventDefault();
    if (!addingForm) return;
    createMutation.mutate(toVariantInput(addingForm));
  }

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
          {variants.map((v) =>
            editingId === v.id ? (
              <tr key={v.id}>
                <Td colSpan={6}>
                  <form onSubmit={handleSaveEdit} className="flex flex-wrap items-end gap-2">
                    <Input
                      placeholder={t("products.variantName")}
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                    <Input
                      placeholder={t("products.priceOverride")}
                      type="number"
                      value={editForm.priceOverride}
                      onChange={(e) => setEditForm({ ...editForm, priceOverride: e.target.value })}
                    />
                    <Input
                      placeholder={t("products.lowStockThreshold")}
                      type="number"
                      value={editForm.lowStockThreshold}
                      onChange={(e) => setEditForm({ ...editForm, lowStockThreshold: e.target.value })}
                    />
                    <Button type="submit">{t("common.save")}</Button>
                    <Button type="button" variant="secondary" onClick={() => setEditingId(null)}>
                      {t("common.cancel")}
                    </Button>
                  </form>
                </Td>
              </tr>
            ) : (
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
                    <button onClick={() => startEdit(v)} className="text-brand-600 hover:underline">
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
            ),
          )}
        </Tbody>
      </Table>

      {addingForm ? (
        <form onSubmit={handleAddSubmit} className="mt-3 flex flex-wrap items-end gap-2">
          <Input
            placeholder={t("products.variantName")}
            value={addingForm.name}
            onChange={(e) => setAddingForm({ ...addingForm, name: e.target.value })}
          />
          <Input
            placeholder={t("products.sku")}
            required
            value={addingForm.sku}
            onChange={(e) => setAddingForm({ ...addingForm, sku: e.target.value })}
          />
          <Input
            placeholder={t("products.priceOverride")}
            type="number"
            value={addingForm.priceOverride}
            onChange={(e) => setAddingForm({ ...addingForm, priceOverride: e.target.value })}
          />
          <Input
            placeholder={t("products.lowStockThreshold")}
            type="number"
            value={addingForm.lowStockThreshold}
            onChange={(e) => setAddingForm({ ...addingForm, lowStockThreshold: e.target.value })}
          />
          <Button type="submit">{t("common.save")}</Button>
          <Button type="button" variant="secondary" onClick={() => setAddingForm(null)}>
            {t("common.cancel")}
          </Button>
        </form>
      ) : (
        <Button type="button" variant="secondary" className="mt-3" onClick={() => setAddingForm(EMPTY_FORM)}>
          {t("products.addVariant")}
        </Button>
      )}
    </div>
  );
}
