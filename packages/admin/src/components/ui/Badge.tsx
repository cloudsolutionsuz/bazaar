import type { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  color?: "green" | "gray" | "red" | "yellow" | "blue";
}

const COLOR_CLASSES: Record<NonNullable<BadgeProps["color"]>, string> = {
  green: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400",
  gray: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  red: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
};

export function Badge({ children, color = "gray" }: BadgeProps) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${COLOR_CLASSES[color]}`}>
      {children}
    </span>
  );
}
