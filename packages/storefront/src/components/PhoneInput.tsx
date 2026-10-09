import { useTranslation } from "react-i18next";

export const UZ_PHONE_PREFIX = "+998";
export const UZ_PHONE_DIGITS = 9;

export function isCompleteUzPhone(digits: string): boolean {
  return digits.length === UZ_PHONE_DIGITS && /^\d+$/.test(digits);
}

export function toFullUzPhone(digits: string): string {
  return `${UZ_PHONE_PREFIX}${digits}`;
}

// Keeps only digits and caps the length, so letters can't be typed at all.
// A pasted full number ("+998 90 123-45-67") loses its country code first -
// otherwise the cap would keep "998901234" and drop the real last digits.
function sanitize(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const national = digits.length > UZ_PHONE_DIGITS && digits.startsWith("998") ? digits.slice(3) : digits;
  return national.slice(0, UZ_PHONE_DIGITS);
}

interface PhoneInputProps {
  // The 9 national digits only - the +998 prefix is fixed and shown, not stored.
  value: string;
  onChange: (digits: string) => void;
  required?: boolean;
  className?: string;
}

export function PhoneInput({ value, onChange, required = false, className = "" }: PhoneInputProps) {
  const { t } = useTranslation();
  const incomplete = value.length > 0 && !isCompleteUzPhone(value);

  return (
    <div className={className}>
      <div
        className={`flex overflow-hidden rounded-md border bg-white text-sm focus-within:border-clay-500 ${
          incomplete ? "border-red-400" : "border-clay-200"
        }`}
      >
        <span className="flex select-none items-center border-r border-clay-200 bg-clay-50 px-3 text-gray-600">{UZ_PHONE_PREFIX}</span>
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          required={required}
          value={value}
          onChange={(e) => onChange(sanitize(e.target.value))}
          maxLength={UZ_PHONE_DIGITS}
          pattern={`[0-9]{${UZ_PHONE_DIGITS}}`}
          title={t("phone.hint")}
          placeholder="901234567"
          className="min-w-0 flex-1 px-3 py-2 focus:outline-none"
        />
      </div>
      {incomplete && <p className="mt-1 text-xs text-red-600">{t("phone.hint")}</p>}
    </div>
  );
}
