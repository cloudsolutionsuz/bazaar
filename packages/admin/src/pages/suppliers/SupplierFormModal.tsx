import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import type { SupplierInput } from "../../api/suppliers";

const EMPTY: SupplierInput = { name: "", contactPerson: "", phone: "", address: "", note: "" };

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: SupplierInput) => void;
  initialValues?: SupplierInput;
  submitting?: boolean;
}

export function SupplierFormModal({ open, onClose, onSubmit, initialValues, submitting }: Props) {
  const { t } = useTranslation();
  const [values, setValues] = useState<SupplierInput>(initialValues ?? EMPTY);

  useEffect(() => {
    if (open) setValues(initialValues ?? EMPTY);
  }, [open, initialValues]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(values);
  }

  return (
    <Modal open={open} onClose={onClose} title={t("suppliers.modalTitle")}>
      <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("suppliers.name")}</label>
          <Input required className="w-full" value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("suppliers.contactPerson")}</label>
          <Input
            className="w-full"
            value={values.contactPerson}
            onChange={(e) => setValues({ ...values, contactPerson: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("suppliers.phone")}</label>
          <Input className="w-full" value={values.phone} onChange={(e) => setValues({ ...values, phone: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("suppliers.address")}</label>
          <Input className="w-full" value={values.address} onChange={(e) => setValues({ ...values, address: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("suppliers.note")}</label>
          <Input className="w-full" value={values.note} onChange={(e) => setValues({ ...values, note: e.target.value })} />
        </div>
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
