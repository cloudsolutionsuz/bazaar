import type { InputHTMLAttributes } from "react";

// Visually distinct from text Input (right-aligned, monospace, tinted
// background) so numeric fields like price/stock read clearly at a glance
// instead of looking like just another text box.
export function NumberInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="number"
      className={`rounded-md border border-gray-300 bg-gray-50 px-3 py-2.5 text-right font-mono text-base focus:border-brand-500 focus:bg-white focus:outline-none ${className}`}
      {...props}
    />
  );
}
