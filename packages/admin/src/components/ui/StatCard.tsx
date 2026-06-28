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
  // Percent change vs. a comparison period (e.g. the previous month) - undefined skips the badge entirely.
  delta?: number;
  // For cost-like figures (COGS, expenses) a rise is bad and a fall is good - the opposite of revenue/profit.
  lowerIsBetter?: boolean;
}) {
  const isGood = delta !== undefined && (lowerIsBetter ? delta < 0 : delta > 0);
  const isBad = delta !== undefined && (lowerIsBetter ? delta > 0 : delta < 0);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`text-xl font-semibold ${highlight ? (value >= 0 ? "text-green-600" : "text-red-600") : "text-gray-900"}`}>
        {isCount ? value : value.toLocaleString()}
        {suffix}
      </div>
      {delta !== undefined && (
        <div className={`text-xs font-medium ${isGood ? "text-green-600" : isBad ? "text-red-600" : "text-gray-400"}`}>
          {delta > 0 ? "+" : ""}
          {delta}%
        </div>
      )}
    </div>
  );
}
