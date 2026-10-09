import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import * as agentsApi from "../../api/agents";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { BonusFields, isValidBonus } from "./BonusFields";

interface BulkBonusModalProps {
  open: boolean;
  agentCount: number;
  onClose: () => void;
  onSaved: () => void;
}

// One bonus for every agent at once; individual agents can still be given
// their own terms afterwards through the edit form.
export function BulkBonusModal({ open, agentCount, onClose, onSaved }: BulkBonusModalProps) {
  const { t } = useTranslation();
  const [bonusType, setBonusType] = useState<agentsApi.AgentBonusType>("PERCENT");
  const [bonusValue, setBonusValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setBonusType("PERCENT");
      setBonusValue("");
      setError(null);
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: agentsApi.bulkSetBonus,
    onSuccess: onSaved,
    onError: () => setError(t("agents.errorSave")),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValidBonus(bonusType, bonusValue)) return setError(t("agents.errorBonus"));
    mutation.mutate({ bonusType, bonusValue: Number(bonusValue) });
  }

  return (
    <Modal open={open} onClose={onClose} title={t("agents.bulkBonusTitle")}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">{t("agents.bulkBonusHint", { count: agentCount })}</p>
        <BonusFields bonusType={bonusType} bonusValue={bonusValue} onTypeChange={setBonusType} onValueChange={setBonusValue} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={mutation.isPending || agentCount === 0}>
            {t("agents.bulkBonusApply")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
