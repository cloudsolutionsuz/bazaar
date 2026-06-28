import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { NumberInput } from "../../components/ui/NumberInput";

export interface VariantFormValues {
  name: string;
  sku: string;
  priceOverride: string;
  stockQuantity: string;
  lowStockThreshold: string;
}

export function emptyVariantFormValues(): VariantFormValues {
  return { name: "", sku: "", priceOverride: "", stockQuantity: "0", lowStockThreshold: "" };
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: VariantFormValues) => void;
  initialValues: VariantFormValues;
  // Stock is only settable when a variant is first created - once it exists,
  // stock changes only through inventory receipts/movements, never edited
  // directly here (mirrors the backend's updateVariantSchema, which omits it).
  showStock: boolean;
  skuEditable: boolean;
  submitting?: boolean;
}

export function VariantFormModal({ open, onClose, onSubmit, initialValues, showStock, skuEditable, submitting }: Props) {
  const { t } = useTranslation();
  const [values, setValues] = useState(initialValues);

  useEffect(() => {
    if (open) setValues(initialValues);
  }, [open, initialValues]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(values);
  }

  return (
    <Modal open={open} onClose={onClose} title={t("products.variantModalTitle")}>
      <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("products.variantName")}</label>
          <Input className="w-full" value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("products.sku")}</label>
          <Input
            className="w-full disabled:bg-gray-50 disabled:text-gray-500"
            required
            disabled={!skuEditable}
            value={values.sku}
            onChange={(e) => setValues({ ...values, sku: e.target.value })}
          />
          {!skuEditable && <p className="mt-1 text-xs text-gray-500">{t("products.skuReadonlyHint")}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t("products.priceOverride")}</label>
            <NumberInput
              className="w-full"
              value={values.priceOverride}
              onChange={(e) => setValues({ ...values, priceOverride: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t("products.lowStockThreshold")}</label>
            <NumberInput
              className="w-full"
              value={values.lowStockThreshold}
              onChange={(e) => setValues({ ...values, lowStockThreshold: e.target.value })}
            />
          </div>
        </div>

        {showStock && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t("products.stock")}</label>
            <NumberInput
              className="w-full"
              value={values.stockQuantity}
              onChange={(e) => setValues({ ...values, stockQuantity: e.target.value })}
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={submitting}>
            {t("common.save")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
