import { Link, Navigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { OrderResult } from "../types/api";

export function OrderConfirmationPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const order = (location.state as { order?: OrderResult } | null)?.order;

  if (!order) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="mx-auto max-w-lg rounded-xl border border-clay-200 bg-white p-8 text-center">
      <h1 className="mb-2 font-display text-2xl font-bold text-clay-700">{t("confirmation.title")}</h1>
      <p className="mb-6 text-sm text-gray-600">{t("confirmation.message")}</p>

      <div className="mb-6 space-y-1 text-sm text-gray-700">
        <div>
          {t("confirmation.orderNumber")}: <span className="font-mono">{order.id.slice(0, 8)}</span>
        </div>
        <div>
          {t("confirmation.total")}: <span className="font-semibold">{order.totalAmount.toLocaleString()}</span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
        <Link to="/" className="inline-block rounded-md bg-clay-600 px-4 py-2 text-sm font-medium text-white hover:bg-clay-700">
          {t("confirmation.backToShop")}
        </Link>
        <Link to="/my-orders" className="inline-block rounded-md border border-clay-200 px-4 py-2 text-sm font-medium text-clay-700 hover:bg-clay-50">
          {t("confirmation.viewMyOrders")}
        </Link>
      </div>
    </div>
  );
}
