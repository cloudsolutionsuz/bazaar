import type { InputHTMLAttributes } from "react";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none ${className}`}
      {...props}
    />
  );
}
