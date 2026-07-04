export function StatCard({
  label,
  value,
  highlight = false,
  isCount = false,
  suffix = "",
  delta,
  lowerIsBetter = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  isCount?: boolean;
  suffix?: string;
  delta?: number;
  lowerIsBetter?: boolean;
}) {
  const isGood = delta !== undefined && (lowerIsBetter ? delta < 0 : delta > 0);
  const isBad = delta !== undefined && (lowerIsBetter ? delta > 0 : delta < 0);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
      <div
        className={`text-xl font-semibold ${
          highlight
            ? value >= 0
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
            : "text-gray-900 dark:text-gray-100"
        }`}
      >
        {isCount ? value : value.toLocaleString()}
        {suffix}
      </div>
      {delta !== undefined && (
        <div
          className={`text-xs font-medium ${
            isGood ? "text-green-600 dark:text-green-400" : isBad ? "text-red-600 dark:text-red-400" : "text-gray-400"
          }`}
        >
          {delta > 0 ? "+" : ""}
          {delta}%
        </div>
      )}
    </div>
  );
}
