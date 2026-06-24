import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import * as storefrontApi from "../api/storefront";
import type { OrderResult } from "../types/api";

const STATUS_KEYS: Record<string, string> = {
  NEW: "myOrders.statusNew",
  PROCESSING: "myOrders.statusProcessing",
  SHIPPED: "myOrders.statusShipped",
  DELIVERED: "myOrders.statusDelivered",
  CANCELLED: "myOrders.statusCancelled",
  REFUNDED: "myOrders.statusRefunded",
};

export function MyOrdersPage() {
  const { t } = useTranslation();
  const [phone, setPhone] = useState("");
  const [orders, setOrders] = useState<OrderResult[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await storefrontApi.getMyOrders(phone);
      setOrders(result.orders);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-2 font-display text-2xl font-bold text-gray-900">{t("myOrders.title")}</h1>
      <p className="mb-4 text-sm text-gray-600">{t("myOrders.hint")}</p>

      <form onSubmit={handleSubmit} className="mb-6 flex gap-2">
        <input
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t("checkout.phone")}
          className="flex-1 rounded-md border border-clay-200 px-3 py-2 text-sm focus:border-clay-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-clay-600 px-4 py-2 text-sm font-medium text-white hover:bg-clay-700 disabled:opacity-50"
        >
          {t("myOrders.search")}
        </button>
      </form>

      {orders !== null && orders.length === 0 && <p className="text-sm text-gray-500">{t("myOrders.empty")}</p>}

      <div className="space-y-3">
        {orders?.map((order) => (
          <div key={order.id} className="rounded-xl border border-clay-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-sm text-gray-500">#{order.id.slice(0, 8)}</span>
              <span className="text-sm font-medium text-clay-700">{t(STATUS_KEYS[order.status] ?? order.status)}</span>
            </div>
            <div className="mb-2 text-sm text-gray-600">{new Date(order.createdAt).toLocaleString()}</div>
            <ul className="mb-2 space-y-1 text-sm text-gray-700">
              {order.items.map((item) => (
                <li key={item.id}>
                  {item.variant?.product.name ?? item.variantId} × {item.quantity}
                </li>
              ))}
            </ul>
            <div className="text-right text-base font-semibold text-gray-900">{order.totalAmount.toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
