import type { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  color?: "green" | "gray" | "red" | "yellow" | "blue";
}

const COLOR_CLASSES: Record<NonNullable<BadgeProps["color"]>, string> = {
  green: "bg-green-100 text-green-800",
  gray: "bg-gray-100 text-gray-700",
  red: "bg-red-100 text-red-700",
  yellow: "bg-yellow-100 text-yellow-800",
  blue: "bg-blue-100 text-blue-700",
};

export function Badge({ children, color = "gray" }: BadgeProps) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${COLOR_CLASSES[color]}`}>{children}</span>;
}
