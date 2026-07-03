import { useState, type InputHTMLAttributes } from "react";

export function NumberInput({
  className = "",
  value,
  onChange,
  onFocus,
  onBlur,
  type: _type,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  const [focused, setFocused] = useState(false);

  const raw = String(value ?? "");
  const displayValue =
    !focused && raw !== "" && /^\d+$/.test(raw)
      ? parseInt(raw, 10).toLocaleString("ru-RU")
      : raw;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!onChange) return;
    const digits = e.target.value.replace(/\D/g, "");
    (e.target as HTMLInputElement).value = digits;
    onChange(e);
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      className={`rounded-md border border-gray-300 bg-gray-50 px-3 py-2.5 text-right font-mono text-base focus:border-brand-500 focus:bg-white focus:outline-none ${className}`}
      value={displayValue}
      onChange={handleChange}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      {...props}
    />
  );
}
