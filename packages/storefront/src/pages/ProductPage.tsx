import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as storefrontApi from "../api/storefront";
import { useCart } from "../cart/CartContext";
import { ApiError } from "../api/client";

const PHONE_PREFIXES = ["+998", "+992", "+996", "+7"];

function formatDeliveryDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

function DeliveryBadge({ minDays, maxDays }: { minDays: number; maxDays: number | null }) {
  const label =
    maxDays && maxDays > minDays
      ? `${minDays}–${maxDays} дней`
      : `${minDays} ${minDays === 1 ? "день" : minDays < 5 ? "дня" : "дней"}`;

  const dateLabel =
    maxDays && maxDays > minDays
      ? `до ${formatDeliveryDate(maxDays)}`
      : formatDeliveryDate(minDays);

  return (
    <div className="mt-3 flex items-center gap-2 rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-sm text-green-700">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <rect x="1" y="3" width="15" height="13" rx="2" />
        <path d="M16 8h4l3 5v3h-7V8z" />
        <circle cx="5.5" cy="18.5" r="2.5" />
        <circle cx="18.5" cy="18.5" r="2.5" />
      </svg>
      <span>
        <span className="font-semibold">Доставим за {label}</span>
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
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [added, setAdded] = useState(false);

  const [reviewPhone, setReviewPhone] = useState("");
  const [reviewPhonePrefix, setReviewPhonePrefix] = useState("+998");
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
    submitReviewMutation.mutate({
      customerPhone: reviewPhonePrefix + reviewPhone.replace(/\D/g, ""),
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
        originalPrice: basePrice,
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
      {added && (
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full bg-clay-600 px-4 py-2 text-sm font-medium text-white shadow-lg">
          ✓ {t("product.added")}
        </div>
      )}
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
                <span className="text-xs text-gray-400">{new Date(review.createdAt).toLocaleDateString("ru-RU")}</span>
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
              <div className="grid grid-cols-2 gap-3">
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
                  <div className="flex gap-1">
                    <select
                      value={reviewPhonePrefix}
                      onChange={(e) => setReviewPhonePrefix(e.target.value)}
                      className="rounded-md border border-clay-200 px-1 py-2 text-xs focus:outline-none"
                    >
                      {PHONE_PREFIXES.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    <input
                      required
                      value={reviewPhone}
                      onChange={(e) => setReviewPhone(e.target.value)}
                      placeholder="901234567"
                      className="flex-1 rounded-md border border-clay-200 px-2 py-2 text-sm focus:border-clay-500 focus:outline-none"
                    />
                  </div>
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
