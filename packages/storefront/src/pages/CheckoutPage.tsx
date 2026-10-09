import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useCart } from "../cart/CartContext";
import { useMagicBoxes } from "../cart/MagicBoxContext";
import * as storefrontApi from "../api/storefront";
import { ApiError } from "../api/client";
import { UZBEKISTAN_REGIONS } from "../data/uzbekistanRegions";
import { PhoneInput, isCompleteUzPhone, toFullUzPhone } from "../components/PhoneInput";
import { getAgentRef } from "../utils/agentRef";

const PROMO_ERROR_KEYS: Record<string, string> = {
  PROMO_NOT_FOUND: "checkout.promoNotFound",
  PROMO_EXPIRED: "checkout.promoExpired",
  PROMO_EXHAUSTED: "checkout.promoExhausted",
  PROMO_MIN_AMOUNT: "checkout.promoMinAmount",
};

const ORDER_ERROR_KEYS: Record<string, string> = {
  INSUFFICIENT_STOCK: "checkout.errorInsufficientStock",
  PLAN_LIMIT_REACHED: "checkout.errorLimitReached",
  INVALID_UNIT: "checkout.errorInvalidUnit",
  UNIT_SIZE_CHANGED: "checkout.errorInvalidUnit",
  VALIDATION_ERROR: "checkout.errorValidation",
};

// The backend stores up to 5 numbers besides the main one: the mandatory
// second number plus these optional extras.
const MAX_EXTRA_PHONES = 4;

export function CheckoutPage() {
  const { t, i18n } = useTranslation();
  // Place names come in both languages; Uzbek unless the visitor chose Russian.
  const placeName = (place: { name: string; nameUz: string }) => (i18n.language === "ru" ? place.name : place.nameUz);
  const navigate = useNavigate();
  const { items, total, clear } = useCart();
  const { unlockedIds: magicBoxIds } = useMagicBoxes();
  const metaQuery = useQuery({ queryKey: ["tenant-meta"], queryFn: storefrontApi.getMeta });
  const meta = metaQuery.data;
  const accentStyle = meta?.themeColor ? { backgroundColor: meta.themeColor } : undefined;
  const configuredPaymentMethods = meta?.paymentMethods?.length ? meta.paymentMethods : null;

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [secondPhone, setSecondPhone] = useState("");
  const [extraPhones, setExtraPhones] = useState<string[]>([]);
  const [addressRegion, setAddressRegion] = useState("");
  const [addressDistrict, setAddressDistrict] = useState("");
  const [addressMahalla, setAddressMahalla] = useState("");
  const [addressNote, setAddressNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discountAmount: number } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoApplying, setPromoApplying] = useState(false);
  const [loyaltyBalance, setLoyaltyBalance] = useState<storefrontApi.LoyaltyBalance | null>(null);
  const [loyaltyChecking, setLoyaltyChecking] = useState(false);
  const [useLoyalty, setUseLoyalty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const afterPromoAmount = total - (appliedPromo?.discountAmount ?? 0);

  const shippingQuery = useQuery({
    queryKey: ["shipping-cost", addressRegion, afterPromoAmount],
    queryFn: () => storefrontApi.getShippingCost(addressRegion, afterPromoAmount),
    enabled: !!addressRegion,
    staleTime: 60_000,
  });
  const shippingCost = shippingQuery.data?.shippingCost ?? 0;

  const districts = UZBEKISTAN_REGIONS.find((r) => r.code === addressRegion)?.districts ?? [];

  const loyaltyUsable =
    !!loyaltyBalance &&
    loyaltyBalance.loyaltyEnabled &&
    loyaltyBalance.loyaltyPoints > 0 &&
    (loyaltyBalance.loyaltyMinRedeem === 0 || loyaltyBalance.loyaltyPoints >= loyaltyBalance.loyaltyMinRedeem);
  const loyaltyDiscount =
    useLoyalty && loyaltyUsable && loyaltyBalance ? Math.min(loyaltyBalance.loyaltyPoints, afterPromoAmount + shippingCost) : 0;
  const finalTotal = afterPromoAmount + shippingCost - loyaltyDiscount;

  const minOrderAmount = meta?.minOrderAmount ?? 0;
  const belowMinimum = total < minOrderAmount;

  // Extras are optional, but a half-typed one is a mistake, not an omission.
  const filledExtraPhones = extraPhones.filter((p) => p !== "");
  const phonesValid =
    isCompleteUzPhone(customerPhone) && isCompleteUzPhone(secondPhone) && filledExtraPhones.every(isCompleteUzPhone);

  function handleRegionChange(code: string) {
    setAddressRegion(code);
    setAddressDistrict("");
  }

  function updateExtraPhone(index: number, value: string) {
    setExtraPhones((phones) => phones.map((p, i) => (i === index ? value : p)));
  }

  function handlePhoneChange(digits: string) {
    setCustomerPhone(digits);
    // A balance looked up for one number must not be spent by another.
    setLoyaltyBalance(null);
    setUseLoyalty(false);
  }

  async function handleCheckLoyalty() {
    if (!isCompleteUzPhone(customerPhone)) return;
    setLoyaltyChecking(true);
    try {
      const balance = await storefrontApi.getLoyaltyBalance(toFullUzPhone(customerPhone));
      setLoyaltyBalance(balance);
      if (!balance.loyaltyEnabled || balance.loyaltyPoints === 0) {
        setUseLoyalty(false);
      }
    } catch {
      setLoyaltyBalance(null);
    } finally {
      setLoyaltyChecking(false);
    }
  }

  async function handleApplyPromo() {
    const code = promoCodeInput.trim().toUpperCase();
    if (!code) return;
    setPromoError(null);
    setPromoApplying(true);
    try {
      const res = await storefrontApi.validatePromoCode(code, total);
      setAppliedPromo({ code, discountAmount: res.discountAmount });
    } catch (err) {
      const errCode = err instanceof ApiError ? err.code : "";
      setPromoError(t(PROMO_ERROR_KEYS[errCode] ?? "checkout.promoInvalid"));
      setAppliedPromo(null);
    } finally {
      setPromoApplying(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (belowMinimum) {
      setError(t("checkout.errorMinOrderAmount", { amount: minOrderAmount.toLocaleString() }));
      return;
    }
    if (!phonesValid) {
      setError(t("checkout.errorPhone"));
      return;
    }

    setSubmitting(true);
    try {
      const result = await storefrontApi.placeOrder({
        customerName,
        customerPhone: toFullUzPhone(customerPhone),
        additionalPhones: [secondPhone, ...filledExtraPhones].map(toFullUzPhone),
        addressRegion,
        addressDistrict,
        addressMahalla,
        addressNote: addressNote || undefined,
        paymentMethod: paymentMethod || undefined,
        promoCode: appliedPromo?.code,
        loyaltyPointsToRedeem: loyaltyDiscount > 0 ? loyaltyDiscount : undefined,
        items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity, unit: i.unit, unitSize: i.unitSize })),
        magicBoxIds: magicBoxIds.length > 0 ? magicBoxIds : undefined,
        agentRef: getAgentRef(),
      });
      clear();
      navigate("/order-confirmation", { state: { order: result.order } });
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      if (code === "MIN_ORDER_AMOUNT") {
        setError(t("checkout.errorMinOrderAmount", { amount: minOrderAmount.toLocaleString() }));
      } else if (ORDER_ERROR_KEYS[code]) {
        setError(t(ORDER_ERROR_KEYS[code]));
      } else {
        setError(t("checkout.errorGeneric"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return <p className="text-gray-500">{t("cart.empty")}</p>;
  }

  const inputClass = "w-full rounded-md border border-clay-200 px-3 py-2 text-sm focus:border-clay-500 focus:outline-none";
  const labelClass = "mb-1 block text-sm font-medium text-gray-700";

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 font-display text-2xl font-bold text-gray-900">{t("checkout.title")}</h1>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-clay-200 bg-white p-6">
        <div>
          <label className={labelClass}>{t("checkout.name")}</label>
          <input required maxLength={200} value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>
            {t("checkout.phone")} <span className="text-red-500">*</span>
          </label>
          <PhoneInput required value={customerPhone} onChange={handlePhoneChange} />
        </div>

        <div>
          <label className={labelClass}>
            {t("checkout.secondPhone")} <span className="text-red-500">*</span>
          </label>
          <PhoneInput required value={secondPhone} onChange={setSecondPhone} />
        </div>

        {extraPhones.map((phone, index) => (
          <div key={index}>
            <label className={labelClass}>{t("checkout.additionalPhone")}</label>
            <div className="flex items-start gap-2">
              <PhoneInput value={phone} onChange={(digits) => updateExtraPhone(index, digits)} className="flex-1" />
              <button
                type="button"
                onClick={() => setExtraPhones((phones) => phones.filter((_, i) => i !== index))}
                aria-label={t("cart.remove")}
                className="rounded-md border border-clay-200 px-3 py-2 text-sm text-gray-500 hover:bg-clay-50"
              >
                ×
              </button>
            </div>
          </div>
        ))}
        {extraPhones.length < MAX_EXTRA_PHONES && (
          <button type="button" onClick={() => setExtraPhones((phones) => [...phones, ""])} className="text-sm text-clay-600 hover:underline">
            + {t("checkout.addPhone")}
          </button>
        )}

        <div>
          <label className={labelClass}>{t("checkout.region")}</label>
          <select required value={addressRegion} onChange={(e) => handleRegionChange(e.target.value)} className={inputClass}>
            <option value="" disabled>
              {t("checkout.regionPlaceholder")}
            </option>
            {UZBEKISTAN_REGIONS.map((region) => (
              <option key={region.code} value={region.code}>
                {placeName(region)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>{t("checkout.district")}</label>
          <select
            required
            disabled={!addressRegion}
            value={addressDistrict}
            onChange={(e) => setAddressDistrict(e.target.value)}
            className={`${inputClass} disabled:bg-clay-50`}
          >
            <option value="" disabled>
              {t("checkout.districtPlaceholder")}
            </option>
            {districts.map((district) => (
              <option key={district.code} value={district.code}>
                {placeName(district)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>{t("checkout.mahalla")}</label>
          <input required maxLength={200} value={addressMahalla} onChange={(e) => setAddressMahalla(e.target.value)} className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>{t("checkout.addressNote")}</label>
          <textarea value={addressNote} maxLength={500} onChange={(e) => setAddressNote(e.target.value)} rows={2} className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>{t("checkout.paymentMethod")}</label>
          <div className="flex flex-wrap gap-4 text-sm">
            {configuredPaymentMethods === null ? (
              <>
                <label className="flex items-center gap-2">
                  <input type="radio" name="paymentMethod" checked={paymentMethod === "cash"} onChange={() => setPaymentMethod("cash")} />
                  {t("checkout.paymentCash")}
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="paymentMethod" checked={paymentMethod === "card"} onChange={() => setPaymentMethod("card")} />
                  {t("checkout.paymentCard")}
                </label>
              </>
            ) : (
              configuredPaymentMethods.map((method) => (
                <label key={method} className="flex items-center gap-2">
                  <input type="radio" name="paymentMethod" checked={paymentMethod === method} onChange={() => setPaymentMethod(method)} />
                  {method}
                </label>
              ))
            )}
          </div>
        </div>

        <div className="border-t border-clay-100 pt-4">
          <label className={labelClass}>{t("checkout.promoCode")}</label>
          {appliedPromo ? (
            <div className="flex items-center justify-between rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm">
              <span className="font-mono font-semibold text-green-800">{appliedPromo.code}</span>
              <span className="text-green-700">−{appliedPromo.discountAmount.toLocaleString()}</span>
              <button
                type="button"
                onClick={() => {
                  setAppliedPromo(null);
                  setPromoCodeInput("");
                }}
                className="ml-3 text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
          ) : (
            // Not a nested <form>: its submit event would bubble up and place the order.
            <div className="flex gap-2">
              <input
                value={promoCodeInput}
                onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleApplyPromo();
                  }
                }}
                placeholder={t("checkout.promoCodePlaceholder")}
                className="flex-1 rounded-md border border-clay-200 px-3 py-2 text-sm uppercase focus:border-clay-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void handleApplyPromo()}
                disabled={!promoCodeInput.trim() || promoApplying}
                className="rounded-md border border-clay-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-clay-50 disabled:opacity-50"
              >
                {t("checkout.promoApply")}
              </button>
            </div>
          )}
          {promoError && <p className="mt-1 text-sm text-red-600">{promoError}</p>}
        </div>

        <div className="border-t border-clay-100 pt-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">{t("checkout.loyaltyPoints")}</label>
            <button
              type="button"
              disabled={loyaltyChecking || !isCompleteUzPhone(customerPhone)}
              onClick={() => void handleCheckLoyalty()}
              className="text-sm text-clay-600 hover:underline disabled:opacity-40"
            >
              {loyaltyChecking ? t("common.loading") : t("checkout.loyaltyCheck")}
            </button>
          </div>
          {loyaltyUsable && loyaltyBalance && (
            <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm">
              <input type="checkbox" checked={useLoyalty} onChange={(e) => setUseLoyalty(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
              <span className="text-yellow-800">
                {t("checkout.loyaltyUse", {
                  points: loyaltyBalance.loyaltyPoints.toLocaleString(),
                  amount: Math.min(loyaltyBalance.loyaltyPoints, afterPromoAmount + shippingCost).toLocaleString(),
                })}
              </span>
            </label>
          )}
          {loyaltyBalance && loyaltyBalance.loyaltyEnabled && loyaltyBalance.loyaltyPoints === 0 && (
            <p className="mt-1 text-sm text-gray-500">{t("checkout.loyaltyNoPoints")}</p>
          )}
          {loyaltyBalance && !loyaltyBalance.loyaltyEnabled && <p className="mt-1 text-sm text-gray-500">{t("checkout.loyaltyNotEnabled")}</p>}
        </div>

        {magicBoxIds.length > 0 && (
          <div className="rounded-xl border-2 border-yellow-400 bg-gradient-to-br from-yellow-50 to-red-50 p-3">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-base">🎁</span>
              <span className="text-sm font-bold text-red-600">Magic Box</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-700">{t("magicBox.checkoutNote", { count: magicBoxIds.length })}</span>
              <span className="font-bold text-green-600">{t("magicBox.zeroPrice")}</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-clay-100 pt-4 text-base text-gray-900">
          <span className="text-sm text-gray-500">{t("cart.total")}</span>
          <span className="font-medium">{total.toLocaleString()}</span>
        </div>
        {appliedPromo && (
          <div className="flex items-center justify-between text-base text-green-700">
            <span className="text-sm">{t("checkout.promoDiscount")}</span>
            <span className="font-medium">−{appliedPromo.discountAmount.toLocaleString()}</span>
          </div>
        )}
        {addressRegion && (
          <div className="flex items-center justify-between text-base text-gray-700">
            <span className="text-sm">{t("checkout.shippingCost")}</span>
            <span className="font-medium">
              {shippingQuery.isLoading ? "…" : shippingCost === 0 ? t("checkout.shippingFree") : `+${shippingCost.toLocaleString()}`}
            </span>
          </div>
        )}
        {loyaltyDiscount > 0 && (
          <div className="flex items-center justify-between text-base text-yellow-700">
            <span className="text-sm">{t("checkout.loyaltyDiscount")}</span>
            <span className="font-medium">−{loyaltyDiscount.toLocaleString()}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-lg font-semibold text-gray-900">
          <span>{t("checkout.finalTotal")}</span>
          <span>{finalTotal.toLocaleString()}</span>
        </div>

        {belowMinimum && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {t("minOrder.remaining", {
              amount: minOrderAmount.toLocaleString(),
              remaining: (minOrderAmount - total).toLocaleString(),
            })}
          </p>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting || belowMinimum || metaQuery.isLoading}
          style={accentStyle}
          className="w-full rounded-md bg-clay-600 px-4 py-3 text-sm font-medium text-white hover:bg-clay-700 disabled:opacity-50"
        >
          {t("checkout.submit")}
        </button>
      </form>
    </div>
  );
}
