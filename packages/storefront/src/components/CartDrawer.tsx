import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useCart } from "../cart/CartContext";

export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { items, updateQuantity, removeItem, total } = useCart();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={onClose}>
      <div className="flex h-full w-full max-w-md flex-col bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-clay-700">{t("cart.title")}</h2>
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800">
            {t("common.close")}
          </button>
        </div>

        {items.length === 0 ? (
          <p className="text-gray-500">{t("cart.empty")}</p>
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto">
            {items.map((item) => (
              <div key={item.variantId} className="flex gap-3 border-b border-clay-100 pb-3">
                {item.imageUrl && <img src={item.imageUrl} alt="" className="h-16 w-16 rounded object-cover" />}
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{item.productName}</div>
                  {item.variantName && <div className="text-xs text-gray-500">{item.variantName}</div>}
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={item.maxStock}
                      value={item.quantity}
                      onChange={(e) => updateQuantity(item.variantId, Number(e.target.value))}
                      className="w-16 rounded border border-clay-200 px-2 py-1 text-sm"
                    />
                    <span className="text-sm text-gray-600">x {item.unitPrice.toLocaleString()}</span>
                  </div>
                </div>
                <button onClick={() => removeItem(item.variantId)} className="self-start text-xs text-red-600 hover:underline">
                  {t("cart.remove")}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 border-t border-clay-200 pt-4">
          <div className="mb-3 flex items-center justify-between text-lg font-semibold text-gray-900">
            <span>{t("cart.total")}</span>
            <span>{total.toLocaleString()}</span>
          </div>
          <Link
            to="/checkout"
            onClick={onClose}
            className={`block rounded-md px-4 py-3 text-center text-sm font-medium text-white ${
              items.length === 0 ? "pointer-events-none bg-gray-300" : "bg-clay-600 hover:bg-clay-700"
            }`}
          >
            {t("cart.checkout")}
          </Link>
        </div>
      </div>
    </div>
  );
}
