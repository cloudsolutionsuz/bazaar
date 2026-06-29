import { useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import * as platformApi from "../../api/platform";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import type { BillingTimelineSegment, TenantStatus } from "../../types/api";

const TENANT_STATUS_KEYS: Record<TenantStatus, string> = {
  TRIAL: "billing.statusTrial",
  ACTIVE: "billing.statusActive",
  PAST_DUE: "billing.statusPastDue",
  BLOCKED: "billing.statusBlocked",
};

// Segment.status carries either "TRIAL" (synthetic, from the tenant's trial
// window) or one of the four real InvoiceStatus values - reuses the billing
// module's existing translations instead of duplicating them under platform.*.
const SEGMENT_LABEL_KEYS: Record<string, string> = {
  TRIAL: "billing.statusTrial",
  PENDING: "billing.invoiceStatusPending",
  PAID: "billing.invoiceStatusPaid",
  OVERDUE: "billing.invoiceStatusOverdue",
  CANCELLED: "billing.invoiceStatusCancelled",
};

const SEGMENT_COLORS: Record<string, string> = {
  TRIAL: "bg-gray-400",
  PENDING: "bg-blue-400",
  PAID: "bg-green-500",
  OVERDUE: "bg-red-500",
  CANCELLED: "bg-gray-300",
};

const CANCELLED_STRIPE_STYLE: CSSProperties = {
  backgroundImage: "repeating-linear-gradient(45deg, #d1d5db 0, #d1d5db 4px, #f3f4f6 4px, #f3f4f6 8px)",
};

// Fixed window (last 6 months + 1 month ahead) so one old tenant doesn't
// stretch the whole chart's scale. Recharts has no native Gantt chart type,
// so this is a hand-rolled timeline of absolutely-positioned divs instead.
function getTimelineWindow(): { start: number; end: number } {
  const start = new Date();
  start.setMonth(start.getMonth() - 6);
  const end = new Date();
  end.setMonth(end.getMonth() + 1);
  return { start: start.getTime(), end: end.getTime() };
}

function segmentStyle(segment: BillingTimelineSegment, windowStart: number, windowMs: number): CSSProperties | null {
  const start = Math.max(new Date(segment.start).getTime(), windowStart);
  const end = Math.min(new Date(segment.end).getTime(), windowStart + windowMs);
  if (end <= start) return null;
  const left = ((start - windowStart) / windowMs) * 100;
  const width = ((end - start) / windowMs) * 100;
  return { left: `${left}%`, width: `${Math.max(width, 0.5)}%` };
}

export function BillingTimelinePage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<TenantStatus | "">("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { start: windowStart, end: windowEnd } = getTimelineWindow();
  const windowMs = windowEnd - windowStart;

  const timelineQuery = useQuery({
    queryKey: ["platform", "billing-timeline", { status, search, page }],
    queryFn: () => platformApi.getBillingTimeline({ status: status || undefined, search: search || undefined, page, pageSize: 20 }),
  });

  const items = timelineQuery.data?.items ?? [];
  const total = timelineQuery.data?.total ?? 0;
  const pageSize = timelineQuery.data?.pageSize ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-gray-900">{t("platform.billingTimeline")}</h1>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-gray-500">{t("common.status")}</label>
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as TenantStatus | "");
              setPage(1);
            }}
          >
            <option value="">{t("common.all")}</option>
            {Object.entries(TENANT_STATUS_KEYS).map(([value, key]) => (
              <option key={value} value={value}>
                {t(key)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">{t("common.search")}</label>
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t("platform.searchPlaceholder")}
          />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        {items.map((item) => (
          <div key={item.tenantId} className="mb-3 flex items-center gap-3">
            <div className="flex w-48 shrink-0 items-center gap-1.5 truncate text-sm text-gray-700">
              <span className="truncate">{item.tenantName}</span>
              {item.isVip && <Badge color="yellow">{t("platform.vipBadge")}</Badge>}
            </div>
            <div className="relative h-7 flex-1 rounded bg-gray-50">
              {item.segments.map((segment, i) => {
                const style = segmentStyle(segment, windowStart, windowMs);
                if (!style) return null;
                const isCancelled = segment.status === "CANCELLED";
                const labelKey = SEGMENT_LABEL_KEYS[segment.status];
                return (
                  <div
                    key={i}
                    title={`${segment.label} — ${labelKey ? t(labelKey) : segment.status}`}
                    className={`absolute top-0 h-full rounded ${isCancelled ? "" : SEGMENT_COLORS[segment.status] ?? "bg-gray-300"}`}
                    style={isCancelled ? { ...style, ...CANCELLED_STRIPE_STYLE } : style}
                  />
                );
              })}
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="py-6 text-center text-sm text-gray-400">{t("common.noData")}</div>}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-gray-600">
        {Object.entries(SEGMENT_LABEL_KEYS).map(([segmentStatus, labelKey]) => (
          <span key={segmentStatus} className="flex items-center gap-1.5">
            <span
              className={`inline-block h-3 w-3 rounded ${segmentStatus === "CANCELLED" ? "" : SEGMENT_COLORS[segmentStatus]}`}
              style={segmentStatus === "CANCELLED" ? CANCELLED_STRIPE_STYLE : undefined}
            />
            {t(labelKey)}
          </span>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
        <span>
          {t("common.page")} {page} / {totalPages}
        </span>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ←
          </Button>
          <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            →
          </Button>
        </div>
      </div>
    </div>
  );
}
