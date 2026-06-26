export function StatCard({
  label,
  value,
  highlight = false,
  isCount = false,
  suffix = "",
}: {
  label: string;
  value: number;
  highlight?: boolean;
  isCount?: boolean;
  suffix?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`text-xl font-semibold ${highlight ? (value >= 0 ? "text-green-600" : "text-red-600") : "text-gray-900"}`}>
        {isCount ? value : value.toLocaleString()}
        {suffix}
      </div>
    </div>
  );
}
