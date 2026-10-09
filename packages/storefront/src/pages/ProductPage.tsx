import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as storefrontApi from "../api/storefront";
import { useCart } from "../cart/CartContext";
import { ApiError } from "../api/client";
import { PhoneInput, isCompleteUzPhone, toFullUzPhone } from "../components/PhoneInput";
import { UNIT_LABEL_KEYS, unitOptionsFor } from "../utils/units";
import type { SaleUnit } from "../types/api";

function formatDeliveryDate(days: number, language: string): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString(language === "uz" ? "uz-UZ" : "ru-RU", { day: "numeric", month: "long" });
}

function BxGyBadge({ deals, selectedVariantId }: { deals: import("../types/api").BxGyDeal[]; selectedVariantId: string }) {
  const { t } = useTranslation();
  const matching = deals.filter((d) => d.buyVariantId === selectedVariantId);
  if (matching.length === 0) return null;
  return (
    <>
      {matching.map((deal) => {
        const getLabel = deal.getVariantName
          ? `${deal.getProductName} (${deal.getVariantName})`
          : deal.getProductName;
        return (
          <div key={deal.id} className="mt-3 flex items-center gap-2 rounded-lg border border-orange-100 bg-orange-50 px-3 py-2 text-sm text-orange-800">
            <span className="text-base">🎁</span>
            <span>
              <span className="font-semibold">{t("product.bxgyDeal", { buyQty: deal.buyQty, getQty: deal.getQty, name: getLabel })}</span>
              <span className="ml-1 text-orange-600 opacity-75">· {deal.promotionName}</span>
            </span>
          </div>
        );
      })}
    </>
  );
}

function DeliveryBadge({ minDays, maxDays }: { minDays: number; maxDays: number | null }) {
  const { t, i18n } = useTranslation();
  const isRange = !!maxDays && maxDays > minDays;
  const label = isRange ? t("product.deliveryRange", { min: minDays, max: maxDays }) : t("product.deliveryIn", { count: minDays });
  const dateLabel = isRange
    ? t("product.deliveryUntil", { date: formatDeliveryDate(maxDays, i18n.language) })
    : formatDeliveryDate(minDays, i18n.language);

  return (
    <div className="mt-3 flex items-center gap-2 rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-sm text-green-700">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <rect x="1" y="3" width="15" height="13" rx="2" />
        <path d="M16 8h4l3 5v3h-7V8z" />
        <circle cx="5.5" cy="18.5" r="2.5" />
        <circle cx="18.5" cy="18.5" r="2.5" />
      </svg>
      <span>
        <span className="font-semibold">{label}</span>
        <span className="ml-1 text-green-600 opacity-80">· {dateLabel}</span>
      </span>
    </div>
  );
}

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type={onChange ? "button" : undefined}
          onClick={() => onChange?.(star)}
          className={`text-2xl leading-none ${star <= value ? "text-yellow-400" : "text-gray-300"} ${onChange ? "hover:text-yellow-300" : "cursor-default"}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function ProductPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const queryClient = useQueryClient();

  const query = useQuery({ queryKey: ["product", id], queryFn: () => storefrontApi.getProduct(id as string) });
  const product = query.data?.product;
  const metaQuery = useQuery({ queryKey: ["tenant-meta"], queryFn: storefrontApi.getMeta });
  const deliveryMinDays = metaQuery.data?.deliveryMinDays ?? null;
  const deliveryMaxDays = metaQuery.data?.deliveryMaxDays ?? null;

  const reviewsQuery = useQuery({
    queryKey: ["product-reviews", id],
    queryFn: () => storefrontApi.getProductReviews(id as string),
    enabled: !!id,
  });

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<SaleUnit>("PIECE");
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [cartNotice, setCartNotice] = useState<{ text: string; ok: boolean } | null>(null);

  const [reviewPhone, setReviewPhone] = useState("");
  const [reviewName, setReviewName] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const submitReviewMutation = useMutation({
    mutationFn: (input: storefrontApi.SubmitReviewInput) => storefrontApi.submitProductReview(id as string, input),
    onSuccess: () => {
      setReviewSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ["product-reviews", id] });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "ALREADY_REVIEWED") {
        setReviewError(t("product.reviewAlreadySubmitted"));
      } else {
        setReviewError(t("product.reviewError"));
      }
    },
  });

  async function handleReviewSubmit(e: FormEvent) {
    e.preventDefault();
    setReviewError(null);
    if (!isCompleteUzPhone(reviewPhone)) {
      setReviewError(t("phone.hint"));
      return;
    }
    submitReviewMutation.mutate({
      customerPhone: toFullUzPhone(reviewPhone),
      customerName: reviewName,
      rating: reviewRating,
      text: reviewText || undefined,
    });
  }

  if (!product) return null;

  const variant = product.variants.find((v) => v.id === selectedVariantId) ?? product.variants[0];
  const basePrice = variant.priceOverride ?? product.price;
  const hasDiscount = !!product.discountPercent && product.discountPercent > 0;
  const unitPrice = hasDiscount ? Math.round(basePrice * (1 - product.discountPercent! / 100)) : basePrice;
  const localizedDescription =
    (i18n.language === "ru" ? product.descriptionRu : i18n.language === "uz" ? product.descriptionUz : null) ||
    product.description;

  // Price is always shown per piece; a block/box is that price times the
  // pieces it holds. A unit bigger than what's left in stock can't be picked.
  const unitOptions = unitOptionsFor(product);
  const unitOption =
    unitOptions.find((o) => o.unit === selectedUnit && o.size <= variant.stockQuantity) ?? unitOptions[0];
  const maxUnits = Math.floor(variant.stockQuantity / unitOption.size);
  const packPrice = unitPrice * unitOption.size;
  const outOfStock = variant.stockQuantity === 0;

  function selectVariant(variantId: string) {
    setSelectedVariantId(variantId);
    setQuantity(1);
  }

  function selectUnit(unit: SaleUnit) {
    setSelectedUnit(unit);
    setQuantity(1);
  }

  function handleAddToCart() {
    const addedUnits = addItem(
      {
        variantId: variant.id,
        productId: product!.id,
        productName: product!.name,
        variantName: variant.name,
        unitPrice,
        originalPrice: basePrice,
        unit: unitOption.unit,
        unitSize: unitOption.size,
        imageUrl: product!.images[0]?.url ?? null,
        maxStock: variant.stockQuantity,
      },
      quantity,
    );
    // The cart may already hold some of this stock, so less than asked - or
    // nothing - can fit.
    setCartNotice(
      addedUnits === 0
        ? { text: t("product.cannotAddMore"), ok: false }
        : addedUnits < quantity
          ? { text: t("product.addedPartial", { count: addedUnits }), ok: true }
          : { text: t("product.added"), ok: true },
    );
    setTimeout(() => setCartNotice(null), 2500);
  }

  return (
    <div>
      {cartNotice && (
        <div
          className={`fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-sm font-medium text-white shadow-lg ${
            cartNotice.ok ? "bg-clay-600" : "bg-red-600"
          }`}
        >
          {cartNotice.ok ? "✓ " : ""}
          {cartNotice.text}
        </div>
      )}
      <button onClick={() => navigate(-1)} className="mb-4 text-sm text-clay-700 hover:underline">
        ← {t("common.back")}
      </button>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          {/* Lightbox overlay */}
          {lightboxOpen && product.images[activeImage] && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
              onClick={() => setLightboxOpen(false)}
            >
              <button
                className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                onClick={() => setLightboxOpen(false)}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
              <img
                src={product.images[activeImage].url}
                alt={product.name}
                className="max-h-[90vh] max-w-[95vw] object-contain"
                onClick={(e) => e.stopPropagation()}
              />
              {product.images.length > 1 && (
                <div className="absolute bottom-4 flex gap-2">
                  {product.images.map((img, i) => (
                    <button
                      key={img.id}
                      onClick={(e) => { e.stopPropagation(); setActiveImage(i); }}
                      className={`h-12 w-12 overflow-hidden rounded border-2 ${i === activeImage ? "border-white" : "border-white/30"}`}
                    >
                      <img src={img.url} alt="" className="h-full w-full object-contain" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div
            className="flex aspect-video cursor-zoom-in items-center justify-center overflow-hidden rounded-xl bg-sand-100"
            onClick={() => product.images[activeImage] && setLightboxOpen(true)}
          >
            {product.images[activeImage] ? (
              <img src={product.images[activeImage].url} alt={product.name} className="h-full w-full object-contain" />
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
                  className={`h-16 w-20 overflow-hidden rounded border-2 ${i === activeImage ? "border-clay-600" : "border-transparent"}`}
                >
                  <img src={img.url} alt="" className="h-full w-full object-contain" />
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
          <div className="mt-2 flex items-baseline gap-3">
            <span className="font-display text-2xl font-semibold text-clay-700">
              {unitPrice.toLocaleString()} {product.currency}
            </span>
            {hasDiscount && (
              <>
                <span className="text-base text-gray-400 line-through">
                  {basePrice.toLocaleString()} {product.currency}
                </span>
                <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                  {t("product.discountPercent", { percent: product.discountPercent })}
                </span>
              </>
            )}
          </div>
          {unitOptions.length > 1 && <div className="mt-0.5 text-xs text-gray-500">{t("product.pricePerPiece")}</div>}

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

          {unitOptions.length > 1 && (
            <div className="mt-4">
              <div className="mb-2 text-sm font-medium text-gray-700">{t("product.buyBy")}</div>
              <div className="flex flex-wrap gap-2">
                {unitOptions.map((option) => (
                  <button
                    key={option.unit}
                    type="button"
                    onClick={() => selectUnit(option.unit)}
                    disabled={option.size > variant.stockQuantity}
                    className={`rounded-md border px-3 py-2 text-sm disabled:opacity-40 ${
                      unitOption.unit === option.unit ? "border-clay-600 bg-clay-50 text-clay-800" : "border-clay-200 text-gray-700"
                    }`}
                  >
                    {option.unit === "PIECE"
                      ? t(UNIT_LABEL_KEYS.PIECE)
                      : t("units.withSize", { unit: t(UNIT_LABEL_KEYS[option.unit]), count: option.size })}
                  </button>
                ))}
              </div>
              {unitOption.unit !== "PIECE" && (
                <div className="mt-2 text-sm text-gray-700">
                  {t("product.packPrice", {
                    unit: t(UNIT_LABEL_KEYS[unitOption.unit]),
                    count: unitOption.size,
                    price: unitPrice.toLocaleString(),
                  })}{" "}
                  <span className="font-semibold text-clay-700">
                    {packPrice.toLocaleString()} {product.currency}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium text-gray-700">{t("product.quantity")}</label>
            <input
              type="number"
              min={1}
              max={Math.max(1, maxUnits)}
              value={quantity}
              disabled={outOfStock}
              onChange={(e) => {
                const wanted = Math.floor(Number(e.target.value)) || 1;
                setQuantity(Math.max(1, Math.min(wanted, Math.max(1, maxUnits))));
              }}
              className="w-20 rounded border border-clay-200 px-2 py-1 text-sm"
            />
            {(quantity > 1 || unitOption.unit !== "PIECE") && !outOfStock && (
              <span className="text-sm text-gray-700">
                {t("product.lineTotal")}:{" "}
                <span className="font-semibold text-gray-900">
                  {(packPrice * quantity).toLocaleString()} {product.currency}
                </span>
                {unitOption.unit !== "PIECE" && (
                  <span className="ml-1 text-gray-500">({t("units.pieces", { count: unitOption.size * quantity })})</span>
                )}
              </span>
            )}
          </div>

          <button
            onClick={handleAddToCart}
            disabled={outOfStock}
            className="mt-4 w-full rounded-md bg-clay-600 px-4 py-3 text-sm font-medium text-white hover:bg-clay-700 disabled:opacity-40"
          >
            {outOfStock ? t("catalog.outOfStock") : t("product.addToCart")}
          </button>

          {product.bxgyDeals && product.bxgyDeals.length > 0 && (
            <BxGyBadge deals={product.bxgyDeals} selectedVariantId={variant.id} />
          )}

          {deliveryMinDays !== null && (
            <DeliveryBadge minDays={deliveryMinDays} maxDays={deliveryMaxDays} />
          )}

          {localizedDescription && (
            <div className="mt-6">
              <h2 className="mb-1 text-sm font-semibold text-gray-700">{t("product.description")}</h2>
              <p className="text-sm text-gray-600">{localizedDescription}</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-10">
        <h2 className="mb-4 font-display text-xl font-bold text-gray-900">{t("product.reviews")}</h2>

        {reviewsQuery.data && reviewsQuery.data.reviewCount > 0 && (
          <div className="mb-4 flex items-center gap-3">
            <StarRating value={Math.round(reviewsQuery.data.averageRating ?? 0)} />
            <span className="text-sm text-gray-600">
              {t("product.reviewAverage", {
                avg: reviewsQuery.data.averageRating?.toFixed(1),
                count: reviewsQuery.data.reviewCount,
              })}
            </span>
          </div>
        )}

        <div className="mb-6 space-y-3">
          {(reviewsQuery.data?.reviews ?? []).length === 0 && (
            <p className="text-sm text-gray-500">{t("product.noReviews")}</p>
          )}
          {(reviewsQuery.data?.reviews ?? []).map((review) => (
            <div key={review.id} className="rounded-xl border border-clay-200 bg-white p-4">
              <div className="mb-1 flex items-center gap-3">
                <StarRating value={review.rating} />
                <span className="font-medium text-gray-900">{review.customerName}</span>
                <span className="text-xs text-gray-400">{new Date(review.createdAt).toLocaleDateString()}</span>
              </div>
              {review.text && <p className="text-sm text-gray-700">{review.text}</p>}
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-clay-200 bg-white p-4">
          <h3 className="mb-3 font-semibold text-gray-900">{t("product.leaveReview")}</h3>
          {reviewSubmitted ? (
            <p className="text-sm text-green-700">{t("product.reviewThanks")}</p>
          ) : (
            <form onSubmit={handleReviewSubmit} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">{t("product.reviewName")}</label>
                  <input
                    required
                    value={reviewName}
                    onChange={(e) => setReviewName(e.target.value)}
                    className="w-full rounded-md border border-clay-200 px-3 py-2 text-sm focus:border-clay-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">{t("product.reviewPhone")}</label>
                  <PhoneInput required value={reviewPhone} onChange={setReviewPhone} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">{t("product.reviewRating")}</label>
                <StarRating value={reviewRating} onChange={setReviewRating} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">{t("product.reviewText")}</label>
                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder={t("product.reviewTextPlaceholder")}
                  className="w-full rounded-md border border-clay-200 px-3 py-2 text-sm focus:border-clay-500 focus:outline-none"
                />
              </div>
              {reviewError && <p className="text-sm text-red-600">{reviewError}</p>}
              <button
                type="submit"
                disabled={submitReviewMutation.isPending}
                className="rounded-md bg-clay-600 px-4 py-2 text-sm font-medium text-white hover:bg-clay-700 disabled:opacity-50"
              >
                {t("product.reviewSubmit")}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
