import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCart } from "../cart/CartContext";
import * as storefrontApi from "../api/storefront";
import { ApiError } from "../api/client";
import { UZBEKISTAN_REGIONS } from "../data/uzbekistanRegions";

const MAX_ADDITIONAL_PHONES = 5;

export function CheckoutPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { items, total, clear } = useCart();

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [additionalPhones, setAdditionalPhones] = useState<string[]>([]);
  const [addressRegion, setAddressRegion] = useState("");
  const [addressDistrict, setAddressDistrict] = useState("");
  const [addressMahalla, setAddressMahalla] = useState("");
  const [addressNote, setAddressNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("cash");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await storefrontApi.placeOrder({
        customerName,
        customerPhone,
        additionalPhones: additionalPhones.filter((p) => p.trim() !== ""),
        addressRegion,
        addressDistrict,
        addressMahalla,
        addressNote: addressNote || undefined,
        paymentMethod: paymentMethod === "cash" ? t("checkout.paymentCash") : t("checkout.paymentCard"),
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
          <input
            required
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            className="w-full rounded-md border border-clay-200 px-3 py-2 text-sm focus:border-clay-500 focus:outline-none"
          />
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
          <div className="flex gap-4 text-sm">
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

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center justify-between border-t border-clay-100 pt-4 text-lg font-semibold text-gray-900">
          <span>{t("cart.total")}</span>
          <span>{total.toLocaleString()}</span>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-clay-600 px-4 py-3 text-sm font-medium text-white hover:bg-clay-700 disabled:opacity-50"
        >
          {t("checkout.submit")}
        </button>
      </form>
    </div>
  );
}
