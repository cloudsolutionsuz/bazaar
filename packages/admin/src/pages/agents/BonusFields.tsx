import { useTranslation } from "react-i18next";
import type { AgentBonusType } from "../../api/agents";
import { NumberInput } from "../../components/ui/NumberInput";
import { Select } from "../../components/ui/Select";

const MAX_PERCENT = 100;

// A percent is 0-100; a fixed sum is any whole number of so'm.
export function isValidBonus(type: AgentBonusType, value: string): boolean {
  if (!/^\d+$/.test(value)) return false;
  return type === "FIXED" || Number(value) <= MAX_PERCENT;
}

export function formatBonus(type: AgentBonusType, value: number, sumLabel: string): string {
  return type === "PERCENT" ? `${value}%` : `${value.toLocaleString()} ${sumLabel}`;
}

interface BonusFieldsProps {
  bonusType: AgentBonusType;
  bonusValue: string;
  onTypeChange: (type: AgentBonusType) => void;
  onValueChange: (value: string) => void;
}

// Shared by the agent form and the "set for all agents" dialog.
export function BonusFields({ bonusType, bonusValue, onTypeChange, onValueChange }: BonusFieldsProps) {
  const { t } = useTranslation();
  const labelClass = "mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300";

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>{t("agents.bonusType")}</label>
          <Select value={bonusType} onChange={(e) => onTypeChange(e.target.value as AgentBonusType)} className="w-full">
            <option value="PERCENT">{t("agents.bonusPercent")}</option>
            <option value="FIXED">{t("agents.bonusFixed")}</option>
          </Select>
        </div>
        <div>
          <label className={labelClass}>{bonusType === "PERCENT" ? t("agents.bonusValuePercent") : t("agents.bonusValueFixed")}</label>
          <NumberInput required value={bonusValue} onChange={(e) => onValueChange(e.target.value)} className="w-full text-left" />
        </div>
      </div>
      <p className="mt-1 text-xs text-gray-500">{bonusType === "PERCENT" ? t("agents.bonusPercentHint") : t("agents.bonusFixedHint")}</p>
    </div>
  );
}
