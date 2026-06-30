import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/Button";
import { Table, Thead, Tbody, Th, Td } from "../../components/ui/Table";
import { VariantFormModal, emptyVariantFormValues, type VariantFormValues } from "./VariantFormModal";

export interface VariantDraft {
  key: string;
  name: string;
  sku: string;
  priceOverride: string;
  costPrice: string;
  stockQuantity: string;
  lowStockThreshold: string;
  supplierId: string;
}

export function emptyVariantDraft(): VariantDraft {
  return { key: crypto.randomUUID(), ...emptyVariantFormValues() };
}

interface Props {
  drafts: VariantDraft[];
  onChange: (drafts: VariantDraft[]) => void;
}

export function NewVariantsTable({ drafts, onChange }: Props) {
  const { t } = useTranslation();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  function remove(key: string) {
    onChange(drafts.filter((d) => d.key !== key));
  }

  function handleAddSubmit(values: VariantFormValues) {
    onChange([...drafts, { key: crypto.randomUUID(), ...values }]);
    setAdding(false);
  }

  function handleEditSubmit(values: VariantFormValues) {
    onChange(drafts.map((d) => (d.key === editingKey ? { ...d, ...values } : d)));
    setEditingKey(null);
  }

  const editingDraft = drafts.find((d) => d.key === editingKey) ?? null;

  return (
    <div>
      {drafts.length > 0 && (
        <Table>
          <Thead>
            <tr>
              <Th>{t("products.variantName")}</Th>
              <Th>{t("products.sku")}</Th>
              <Th>{t("products.priceOverride")}</Th>
              <Th>{t("products.costPrice")}</Th>
              <Th>{t("products.stock")}</Th>
              <Th>{t("products.lowStockThreshold")}</Th>
              <Th>{t("common.actions")}</Th>
            </tr>
          </Thead>
          <Tbody>
            {drafts.map((d) => (
              <tr key={d.key}>
                <Td>{d.name || "—"}</Td>
                <Td>{d.sku || "—"}</Td>
                <Td>{d.priceOverride || "—"}</Td>
                <Td>{d.costPrice || "—"}</Td>
                <Td>{d.stockQuantity || "0"}</Td>
                <Td>{d.lowStockThreshold || "—"}</Td>
                <Td>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setEditingKey(d.key)} className="text-brand-600 hover:underline">
                      {t("common.edit")}
                    </button>
                    <button type="button" onClick={() => remove(d.key)} className="text-red-600 hover:underline">
                      {t("common.delete")}
                    </button>
                  </div>
                </Td>
              </tr>
            ))}
          </Tbody>
        </Table>
      )}

      <Button type="button" variant="secondary" className="mt-3" onClick={() => setAdding(true)}>
        {t("products.addVariant")}
      </Button>

      <VariantFormModal
        open={adding}
        onClose={() => setAdding(false)}
        initialValues={emptyVariantFormValues()}
        showStock
        skuEditable
        onSubmit={handleAddSubmit}
      />

      <VariantFormModal
        open={editingDraft !== null}
        onClose={() => setEditingKey(null)}
        initialValues={editingDraft ?? emptyVariantFormValues()}
        showStock
        skuEditable
        onSubmit={handleEditSubmit}
      />
    </div>
  );
}
