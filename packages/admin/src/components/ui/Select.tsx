import type { SelectHTMLAttributes } from "react";

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none ${className}`}
      {...props}
    />
  );
}
