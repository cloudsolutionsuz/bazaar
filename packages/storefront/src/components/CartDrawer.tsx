import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { cartLineKey, linePieces, lineTotal, useCart } from "../cart/CartContext";
import { useMagicBoxes } from "../cart/MagicBoxContext";
import { getMeta } from "../api/storefront";
import { UNIT_LABEL_KEYS } from "../utils/units";

export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { items, updateQuantity, removeItem, total } = useCart();
  const { unlockedBoxes } = useMagicBoxes();
  const metaQuery = useQuery({ queryKey: ["tenant-meta"], queryFn: getMeta });
  const minOrderAmount = metaQuery.data?.minOrderAmount ?? 0;

  const originalTotal = items.reduce((sum, i) => sum + i.originalPrice * linePieces(i), 0);
  const discountTotal = originalTotal - total;
  const belowMinimum = items.length > 0 && total < minOrderAmount;
  const canCheckout = items.length > 0 && !belowMinimum;

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
            {items.map((item) => {
              const key = cartLineKey(item);
              const packed = item.unit !== "PIECE";
              return (
                <div key={key} className="flex gap-3 border-b border-clay-100 pb-3">
                  {item.imageUrl && <img src={item.imageUrl} alt="" className="h-16 w-16 rounded object-cover" />}
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{item.productName}</div>
                    {item.variantName && <div className="text-xs text-gray-500">{item.variantName}</div>}
                    {packed && (
                      <div className="text-xs text-clay-700">
                        {t("units.withSize", { unit: t(UNIT_LABEL_KEYS[item.unit]), count: item.unitSize })}
                      </div>
                    )}
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateQuantity(key, Number(e.target.value))}
                        className="w-16 rounded border border-clay-200 px-2 py-1 text-sm"
                      />
                      <div className="text-sm">
                        <span className="text-gray-900">{lineTotal(item).toLocaleString()}</span>
                        {item.originalPrice !== item.unitPrice && (
                          <span className="ml-1 text-gray-400 line-through">
                            {(item.originalPrice * linePieces(item)).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-0.5 text-xs text-gray-500">
                      {t("cart.piecesAtPrice", { count: linePieces(item), price: item.unitPrice.toLocaleString() })}
                    </div>
                  </div>
                  <button onClick={() => removeItem(key)} className="self-start text-xs text-red-600 hover:underline">
                    {t("cart.remove")}
                  </button>
                </div>
              );
            })}

            {unlockedBoxes.length > 0 && (
              <div className="rounded-xl border-2 border-yellow-400 bg-gradient-to-br from-yellow-50 to-red-50 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-lg">🎁</span>
                  <span className="text-sm font-bold text-red-600">{t("magicBox.free")}</span>
                </div>
                <div className="space-y-2">
                  {unlockedBoxes.map((box) => {
                    const gift = box.giftVariant;
                    const giftImage = gift?.product.images[0]?.url;
                    const giftName = gift ? `${gift.product.name}${gift.name ? ` (${gift.name})` : ""}` : box.name;
                    return (
                      <div key={box.id} className="flex items-center gap-2">
                        {giftImage
                          ? <img src={giftImage} alt="" className="h-10 w-10 rounded object-cover" />
                          : <span className="flex h-10 w-10 items-center justify-center rounded bg-yellow-200 text-lg">🎁</span>
                        }
                        <span className="flex-1 text-sm font-medium text-gray-800">{giftName}</span>
                        <span className="rounded-full bg-green-500 px-2 py-0.5 text-xs font-bold text-white">{t("magicBox.zeroPrice")}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 border-t border-clay-200 pt-4">
          {discountTotal > 0 && (
            <div className="mb-1 space-y-1 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>{t("cart.subtotal")}</span>
                <span>{originalTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>{t("cart.discount")}</span>
                <span>−{discountTotal.toLocaleString()}</span>
              </div>
            </div>
          )}
          <div className="mb-3 flex items-center justify-between text-lg font-semibold text-gray-900">
            <span>{t("cart.total")}</span>
            <span>{total.toLocaleString()}</span>
          </div>
          {belowMinimum && (
            <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {t("minOrder.remaining", {
                amount: minOrderAmount.toLocaleString(),
                remaining: (minOrderAmount - total).toLocaleString(),
              })}
            </p>
          )}
          <Link
            to="/checkout"
            onClick={onClose}
            aria-disabled={!canCheckout}
            className={`block rounded-md px-4 py-3 text-center text-sm font-medium text-white ${
              canCheckout ? "bg-clay-600 hover:bg-clay-700" : "pointer-events-none bg-gray-300"
            }`}
          >
            {t("cart.checkout")}
          </Link>
        </div>
      </div>
    </div>
  );
}
