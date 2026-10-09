import { useTranslation } from "react-i18next";

const PREFIX = "+998";
const DIGITS = 9;

export function isCompleteUzPhone(digits: string): boolean {
  return digits.length === DIGITS && /^\d+$/.test(digits);
}

export function toFullUzPhone(digits: string): string {
  return `${PREFIX}${digits}`;
}

// A stored number ("998901234567") back to the 9 digits this input edits.
export function toNationalDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return (digits.length > DIGITS && digits.startsWith("998") ? digits.slice(3) : digits).slice(0, DIGITS);
}

interface UzPhoneInputProps {
  // The 9 national digits only - the +998 prefix is fixed.
  value: string;
  onChange: (digits: string) => void;
  required?: boolean;
  className?: string;
}

// Digits only, never more than 9: letters can't be typed and a pasted full
// number has its country code stripped rather than its tail cut off.
export function UzPhoneInput({ value, onChange, required = false, className = "" }: UzPhoneInputProps) {
  const { t } = useTranslation();
  const incomplete = value.length > 0 && !isCompleteUzPhone(value);

  return (
    <div className={className}>
      <div
        className={`flex overflow-hidden rounded-md border bg-white text-sm focus-within:border-brand-500 dark:bg-gray-800 ${
          incomplete ? "border-red-400" : "border-gray-300 dark:border-gray-600"
        }`}
      >
        <span className="flex select-none items-center border-r border-gray-300 bg-gray-50 px-3 text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300">
          {PREFIX}
        </span>
        <input
          type="tel"
          inputMode="numeric"
          required={required}
          value={value}
          onChange={(e) => onChange(toNationalDigits(e.target.value))}
          maxLength={DIGITS}
          pattern={`[0-9]{${DIGITS}}`}
          title={t("common.phoneHint")}
          placeholder="901234567"
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-gray-900 focus:outline-none dark:text-gray-100"
        />
      </div>
      {incomplete && <p className="mt-1 text-xs text-red-600">{t("common.phoneHint")}</p>}
    </div>
  );
}
