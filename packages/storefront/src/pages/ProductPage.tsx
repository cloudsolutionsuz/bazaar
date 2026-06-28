import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import * as storefrontApi from "../api/storefront";
import { useCart } from "../cart/CartContext";

export function ProductPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();

  const query = useQuery({ queryKey: ["product", id], queryFn: () => storefrontApi.getProduct(id as string) });
  const product = query.data?.product;

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [added, setAdded] = useState(false);

  if (!product) return null;

  const variant = product.variants.find((v) => v.id === selectedVariantId) ?? product.variants[0];
  const unitPrice = variant.priceOverride ?? product.price;

  function selectVariant(variantId: string) {
    setSelectedVariantId(variantId);
    setQuantity(1);
  }

  function handleAddToCart() {
    addItem(
      {
        variantId: variant.id,
        productId: product!.id,
        productName: product!.name,
        variantName: variant.name,
        unitPrice,
        imageUrl: product!.images[0]?.url ?? null,
        maxStock: variant.stockQuantity,
      },
      quantity,
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <div>
      <button onClick={() => navigate(-1)} className="mb-4 text-sm text-clay-700 hover:underline">
        ← {t("common.back")}
      </button>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-sand-100">
            {product.images[activeImage] ? (
              <img src={product.images[activeImage].url} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <span className="font-display text-clay-300">Bazaar</span>
            )}
          </div>
          {product.images.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {product.images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setActiveImage(i)}
                  className={`h-16 w-16 overflow-hidden rounded border-2 ${i === activeImage ? "border-clay-600" : "border-transparent"}`}
                >
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">{product.name}</h1>
          {(product.brand || product.color) && (
            <div className="mt-1 text-sm text-gray-500">
              {[product.brand, product.color].filter(Boolean).join(" · ")}
            </div>
          )}
          <div className="mt-2 font-display text-2xl font-semibold text-clay-700">
            {unitPrice.toLocaleString()} {product.currency}
          </div>

          {product.variants.length > 1 && (
            <div className="mt-4">
              <div className="mb-2 text-sm font-medium text-gray-700">{t("product.variant")}</div>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => selectVariant(v.id)}
                    disabled={v.stockQuantity === 0}
                    className={`rounded-md border px-3 py-2 text-sm disabled:opacity-40 ${
                      variant.id === v.id ? "border-clay-600 bg-clay-50 text-clay-800" : "border-clay-200 text-gray-700"
                    }`}
                  >
                    {v.name ?? v.sku}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">{t("product.quantity")}</label>
            <input
              type="number"
              min={1}
              max={variant.stockQuantity}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Math.min(Number(e.target.value), variant.stockQuantity)))}
              className="w-20 rounded border border-clay-200 px-2 py-1 text-sm"
            />
          </div>

          <button
            onClick={handleAddToCart}
            disabled={variant.stockQuantity === 0}
            className="mt-4 w-full rounded-md bg-clay-600 px-4 py-3 text-sm font-medium text-white hover:bg-clay-700 disabled:opacity-40"
          >
            {variant.stockQuantity === 0 ? t("catalog.outOfStock") : added ? t("product.added") : t("product.addToCart")}
          </button>

          {product.description && (
            <div className="mt-6">
              <h2 className="mb-1 text-sm font-semibold text-gray-700">{t("product.description")}</h2>
              <p className="text-sm text-gray-600">{product.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
