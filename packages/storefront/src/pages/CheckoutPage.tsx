import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useCart } from "../cart/CartContext";
import * as storefrontApi from "../api/storefront";
import { ApiError } from "../api/client";
import { UZBEKISTAN_REGIONS } from "../data/uzbekistanRegions";

const PROMO_ERROR_KEYS: Record<string, string> = {
  PROMO_NOT_FOUND: "checkout.promoNotFound",
  PROMO_EXPIRED: "checkout.promoExpired",
  PROMO_EXHAUSTED: "checkout.promoExhausted",
  PROMO_MIN_AMOUNT: "checkout.promoMinAmount",
};

const MAX_ADDITIONAL_PHONES = 5;

const PHONE_PREFIXES = [
  { label: "🇺🇿 +998", value: "+998" },
  { label: "🇹🇯 +992", value: "+992" },
  { label: "🇰🇬 +996", value: "+996" },
  { label: "🇰🇿 +7", value: "+7" },
];

export function CheckoutPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { items, total, clear } = useCart();
  const metaQuery = useQuery({ queryKey: ["tenant-meta"], queryFn: storefrontApi.getMeta });
  const accentStyle = metaQuery.data?.themeColor ? { backgroundColor: metaQuery.data.themeColor } : undefined;

  const [customerName, setCustomerName] = useState("");
  const [phonePrefix, setPhonePrefix] = useState("+998");
  const [customerPhone, setCustomerPhone] = useState("");
  const [additionalPhones, setAdditionalPhones] = useState<string[]>([]);
  const [addressRegion, setAddressRegion] = useState("");
  const [addressDistrict, setAddressDistrict] = useState("");
  const [addressMahalla, setAddressMahalla] = useState("");
  const [addressNote, setAddressNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("cash");
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

  function handleRegionChange(code: string) {
    setAddressRegion(code);
    setAddressDistrict("");
  }

  function addPhoneField() {
    setAdditionalPhones((phones) => [...phones, ""]);
  }

  function updatePhoneField(index: number, value: string) {
    setAdditionalPhones((phones) => phones.map((p, i) => (i === index ? value : p)));
  }

  function removePhoneField(index: number) {
    setAdditionalPhones((phones) => phones.filter((_, i) => i !== index));
  }

  async function handleCheckLoyalty() {
    const phone = phonePrefix + customerPhone.replace(/\D/g, "");
    if (!phone || phone.length < 7) return;
    setLoyaltyChecking(true);
    try {
      const balance = await storefrontApi.getLoyaltyBalance(phone);
      setLoyaltyBalance(balance);
      if (!balance.loyaltyEnabled || balance.loyaltyPoints === 0) {
        setUseLoyalty(false);
      }
    } finally {
      setLoyaltyChecking(false);
    }
  }

  async function handleApplyPromo(e: FormEvent) {
    e.preventDefault();
    const code = promoCodeInput.trim().toUpperCase();
    if (!code) return;
    setPromoError(null);
    setPromoApplying(true);
    try {
      const res = await storefrontApi.validatePromoCode(code, total);
      setAppliedPromo({ code, discountAmount: res.discountAmount });
    } catch (err) {
      const errCode = err instanceof ApiError ? err.code : "";
      const key = PROMO_ERROR_KEYS[errCode] ?? "checkout.promoInvalid";
      setPromoError(t(key));
      setAppliedPromo(null);
    } finally {
      setPromoApplying(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const loyaltyToRedeem = useLoyalty && loyaltyBalance?.loyaltyEnabled && loyaltyBalance.loyaltyPoints > 0
        ? Math.min(loyaltyBalance.loyaltyPoints, afterPromoAmount + shippingCost)
        : 0;
      const result = await storefrontApi.placeOrder({
        customerName,
        customerPhone: phonePrefix + customerPhone.replace(/\D/g, ""),
        additionalPhones: additionalPhones.filter((p) => p.trim() !== ""),
        addressRegion,
        addressDistrict,
        addressMahalla,
        addressNote: addressNote || undefined,
        paymentMethod: paymentMethod === "cash" ? t("checkout.paymentCash") : t("checkout.paymentCard"),
        promoCode: appliedPromo?.code,
        loyaltyPointsToRedeem: loyaltyToRedeem > 0 ? loyaltyToRedeem : undefined,
        items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
      });
      clear();
      navigate("/order-confirmation", { state: { order: result.order } });
    } catch (err) {
      if (err instanceof ApiError && err.code === "INSUFFICIENT_STOCK") {
        setError(t("checkout.errorInsufficientStock"));
      } else if (err instanceof ApiError && err.code === "PLAN_LIMIT_REACHED") {
        setError(t("checkout.errorLimitReached"));
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return <p className="text-gray-500">{t("cart.empty")}</p>;
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 font-display text-2xl font-bold text-gray-900">{t("checkout.title")}</h1>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-clay-200 bg-white p-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("checkout.name")}</label>
          <input
            required
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="w-full rounded-md border border-clay-200 px-3 py-2 text-sm focus:border-clay-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("checkout.phone")}</label>
          <div className="flex gap-2">
            <select
              value={phonePrefix}
              onChange={(e) => setPhonePrefix(e.target.value)}
              className="rounded-md border border-clay-200 px-2 py-2 text-sm focus:border-clay-500 focus:outline-none"
            >
              {PHONE_PREFIXES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <input
              required
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="901234567"
              className="flex-1 rounded-md border border-clay-200 px-3 py-2 text-sm focus:border-clay-500 focus:outline-none"
            />
          </div>
        </div>

        {additionalPhones.map((phone, index) => (
          <div key={index} className="flex items-end gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-gray-700">{t("checkout.additionalPhone")}</label>
              <input
                value={phone}
                onChange={(e) => updatePhoneField(index, e.target.value)}
                className="w-full rounded-md border border-clay-200 px-3 py-2 text-sm focus:border-clay-500 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => removePhoneField(index)}
              className="rounded-md border border-clay-200 px-3 py-2 text-sm text-gray-500 hover:bg-clay-50"
            >
              ×
            </button>
          </div>
        ))}
        {additionalPhones.length < MAX_ADDITIONAL_PHONES && (
          <button type="button" onClick={addPhoneField} className="text-sm text-clay-600 hover:underline">
            + {t("checkout.addPhone")}
          </button>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("checkout.region")}</label>
          <select
            required
            value={addressRegion}
            onChange={(e) => handleRegionChange(e.target.value)}
            className="w-full rounded-md border border-clay-200 px-3 py-2 text-sm focus:border-clay-500 focus:outline-none"
          >
            <option value="" disabled>
              {t("checkout.regionPlaceholder")}
            </option>
            {UZBEKISTAN_REGIONS.map((region) => (
              <option key={region.code} value={region.code}>
                {region.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("checkout.district")}</label>
          <select
            required
            disabled={!addressRegion}
            value={addressDistrict}
            onChange={(e) => setAddressDistrict(e.target.value)}
            className="w-full rounded-md border border-clay-200 px-3 py-2 text-sm focus:border-clay-500 focus:outline-none disabled:bg-clay-50"
          >
            <option value="" disabled>
              {t("checkout.districtPlaceholder")}
            </option>
            {districts.map((district) => (
              <option key={district.code} value={district.code}>
                {district.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("checkout.mahalla")}</label>
          <input
            required
            value={addressMahalla}
            onChange={(e) => setAddressMahalla(e.target.value)}
            className="w-full rounded-md border border-clay-200 px-3 py-2 text-sm focus:border-clay-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("checkout.addressNote")}</label>
          <textarea
            value={addressNote}
            onChange={(e) => setAddressNote(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-clay-200 px-3 py-2 text-sm focus:border-clay-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("checkout.paymentMethod")}</label>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" name="paymentMethod" checked={paymentMethod === "cash"} onChange={() => setPaymentMethod("cash")} />
              {t("checkout.paymentCash")}
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="paymentMethod" checked={paymentMethod === "card"} onChange={() => setPaymentMethod("card")} />
              {t("checkout.paymentCard")}
            </label>
          </div>
        </div>

        <div className="border-t border-clay-100 pt-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("checkout.promoCode")}</label>
          {appliedPromo ? (
            <div className="flex items-center justify-between rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm">
              <span className="font-mono font-semibold text-green-800">{appliedPromo.code}</span>
              <span className="text-green-700">−{appliedPromo.discountAmount.toLocaleString()}</span>
              <button
                type="button"
                onClick={() => { setAppliedPromo(null); setPromoCodeInput(""); }}
                className="ml-3 text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
          ) : (
            <form onSubmit={handleApplyPromo} className="flex gap-2">
              <input
                value={promoCodeInput}
                onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                placeholder={t("checkout.promoCodePlaceholder")}
                className="flex-1 rounded-md border border-clay-200 px-3 py-2 text-sm uppercase focus:border-clay-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!promoCodeInput.trim() || promoApplying}
                className="rounded-md border border-clay-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-clay-50 disabled:opacity-50"
              >
                {t("checkout.promoApply")}
              </button>
            </form>
          )}
          {promoError && <p className="mt-1 text-sm text-red-600">{promoError}</p>}
        </div>

        <div className="border-t border-clay-100 pt-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">{t("checkout.loyaltyPoints")}</label>
            <button
              type="button"
              disabled={loyaltyChecking || !customerPhone.trim()}
              onClick={handleCheckLoyalty}
              className="text-sm text-clay-600 hover:underline disabled:opacity-40"
            >
              {loyaltyChecking ? t("common.loading") : t("checkout.loyaltyCheck")}
            </button>
          </div>
          {loyaltyBalance && loyaltyBalance.loyaltyEnabled && loyaltyBalance.loyaltyPoints > 0 &&
            (loyaltyBalance.loyaltyMinRedeem === 0 || loyaltyBalance.loyaltyPoints >= loyaltyBalance.loyaltyMinRedeem) && (
            <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={useLoyalty}
                onChange={(e) => setUseLoyalty(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
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
          {loyaltyBalance && !loyaltyBalance.loyaltyEnabled && (
            <p className="mt-1 text-sm text-gray-500">{t("checkout.loyaltyNotEnabled")}</p>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

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
              {shippingQuery.isLoading
                ? "…"
                : shippingCost === 0
                ? t("checkout.shippingFree")
                : `+${shippingCost.toLocaleString()}`}
            </span>
          </div>
        )}
        {useLoyalty && loyaltyBalance && loyaltyBalance.loyaltyPoints > 0 && (() => {
          const loyaltyDiscount = Math.min(loyaltyBalance.loyaltyPoints, afterPromoAmount + shippingCost);
          return loyaltyDiscount > 0 ? (
            <div className="flex items-center justify-between text-base text-yellow-700">
              <span className="text-sm">{t("checkout.loyaltyDiscount")}</span>
              <span className="font-medium">−{loyaltyDiscount.toLocaleString()}</span>
            </div>
          ) : null;
        })()}
        <div className="flex items-center justify-between text-lg font-semibold text-gray-900">
          <span>{t("checkout.finalTotal")}</span>
          <span>{(() => {
            const loyaltyDiscount = useLoyalty && loyaltyBalance?.loyaltyEnabled && loyaltyBalance.loyaltyPoints > 0
              ? Math.min(loyaltyBalance.loyaltyPoints, afterPromoAmount + shippingCost)
              : 0;
            return (afterPromoAmount + shippingCost - loyaltyDiscount).toLocaleString();
          })()}</span>
        </div>

        <button
          type="submit"
          disabled={submitting}
          style={accentStyle}
          className="w-full rounded-md bg-clay-600 px-4 py-3 text-sm font-medium text-white hover:bg-clay-700 disabled:opacity-50"
        >
          {t("checkout.submit")}
        </button>
      </form>
    </div>
  );
}
