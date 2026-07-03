import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import * as tenantsApi from "../api/tenants";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";

export function SettingsPage() {
  const { t } = useTranslation();
  const { tenant, refreshTenant } = useAuth();
  const [telegramChatId, setTelegramChatId] = useState(tenant?.telegramChatId ?? "");
  const [themeColor, setThemeColor] = useState(tenant?.themeColor ?? "#1f7a64");
  const [description, setDescription] = useState(tenant?.description ?? "");
  const [inn, setInn] = useState(tenant?.inn ?? "");
  const [companyName, setCompanyName] = useState(tenant?.companyName ?? "");
  const [contactPhone, setContactPhone] = useState(tenant?.contactPhone ?? "");
  const [instagram, setInstagram] = useState(tenant?.instagram ?? "");
  const [facebook, setFacebook] = useState(tenant?.facebook ?? "");
  const [youtube, setYoutube] = useState(tenant?.youtube ?? "");
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(tenant?.loyaltyEnabled ?? false);
  const [loyaltyPointsRate, setLoyaltyPointsRate] = useState(String(tenant?.loyaltyPointsRate ?? 1));
  const [loyaltyMinRedeem, setLoyaltyMinRedeem] = useState(String(tenant?.loyaltyMinRedeem ?? 0));
  const [minOrderAmount, setMinOrderAmount] = useState(String(tenant?.minOrderAmount ?? 0));
  const [paymentMethods, setPaymentMethods] = useState<string[]>(
    tenant?.paymentMethods?.length ? tenant.paymentMethods : []
  );
  const [newPaymentMethod, setNewPaymentMethod] = useState("");
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const settingsMutation = useMutation({
    mutationFn: () =>
      tenantsApi.updateMySettings({
        telegramChatId: telegramChatId || null,
        themeColor: themeColor || null,
        description: description || null,
        inn: inn || null,
        companyName: companyName || null,
        contactPhone: contactPhone || null,
        instagram: instagram || null,
        facebook: facebook || null,
        youtube: youtube || null,
        loyaltyEnabled,
        loyaltyPointsRate: Number(loyaltyPointsRate) || 1,
        loyaltyMinRedeem: Number(loyaltyMinRedeem) || 0,
        minOrderAmount: Number(minOrderAmount) || 0,
        paymentMethods,
      }),
    onSuccess: async () => {
      await refreshTenant();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const logoMutation = useMutation({
    mutationFn: (file: File) => tenantsApi.uploadLogo(file),
    onSuccess: () => refreshTenant(),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    settingsMutation.mutate();
  }

  function handleLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) logoMutation.mutate(file);
    e.target.value = "";
  }

  return (
    <div className="max-w-md">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">{t("settings.title")}</h1>

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
        <label className="mb-2 block text-sm font-medium text-gray-700">{t("settings.logo")}</label>
        <div className="flex items-center gap-4">
          {tenant?.logoUrl ? (
            <img src={tenant.logoUrl} alt="" className="h-16 w-16 rounded-md border border-gray-200 object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed border-gray-300 text-xs text-gray-400">
              {t("settings.noLogo")}
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
          <Button type="button" variant="secondary" disabled={logoMutation.isPending} onClick={() => fileInputRef.current?.click()}>
            {t("settings.uploadLogo")}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("settings.inn")} <span className="text-red-500">*</span>
          </label>
          <Input required value={inn} onChange={(e) => setInn(e.target.value)} className="w-full" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("settings.companyName")} <span className="text-red-500">*</span>
          </label>
          <Input required value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("settings.contactPhone")}</label>
          <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="w-full" />
        </div>

        <hr className="border-gray-100" />

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("settings.instagram")}</label>
          <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="https://instagram.com/..." className="w-full" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("settings.facebook")}</label>
          <Input value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="https://facebook.com/..." className="w-full" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("settings.youtube")}</label>
          <Input value={youtube} onChange={(e) => setYoutube(e.target.value)} placeholder="https://youtube.com/@..." className="w-full" />
        </div>

        <hr className="border-gray-100" />

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("settings.telegramChatId")}</label>
          <Input value={telegramChatId} onChange={(e) => setTelegramChatId(e.target.value)} className="w-full" />
          <p className="mt-1 text-xs text-gray-500">{t("settings.telegramChatIdHint")}</p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("settings.themeColor")}</label>
          <input
            type="color"
            value={themeColor}
            onChange={(e) => setThemeColor(e.target.value)}
            className="h-10 w-20 rounded-md border border-gray-300"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("settings.description")}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            rows={4}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>

        <hr className="border-gray-100" />

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">{t("settings.loyalty")}</label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={loyaltyEnabled}
              onChange={(e) => setLoyaltyEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">{t("settings.loyaltyEnabled")}</span>
          </label>
        </div>

        {loyaltyEnabled && (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t("settings.loyaltyRate")}</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={loyaltyPointsRate}
                  onChange={(e) => setLoyaltyPointsRate(e.target.value)}
                  className="w-24"
                />
                <span className="text-sm text-gray-500">{t("settings.loyaltyRateHint")}</span>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t("settings.loyaltyMinRedeem")}</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  value={loyaltyMinRedeem}
                  onChange={(e) => setLoyaltyMinRedeem(e.target.value)}
                  className="w-24"
                />
                <span className="text-sm text-gray-500">{t("settings.loyaltyMinRedeemHint")}</span>
              </div>
            </div>
          </>
        )}

        <hr className="border-gray-100" />

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("settings.minOrderAmount")}</label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              value={minOrderAmount}
              onChange={(e) => setMinOrderAmount(e.target.value)}
              className="w-32"
            />
            <span className="text-sm text-gray-500">{t("settings.minOrderAmountHint")}</span>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">{t("settings.paymentMethods")}</label>
          <p className="mb-2 text-xs text-gray-500">{t("settings.paymentMethodsHint")}</p>
          <div className="space-y-2">
            {paymentMethods.map((method, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={method}
                  onChange={(e) => setPaymentMethods((prev) => prev.map((m, j) => j === i ? e.target.value : m))}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => setPaymentMethods((prev) => prev.filter((_, j) => j !== i))}
                >
                  ×
                </Button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Input
                value={newPaymentMethod}
                onChange={(e) => setNewPaymentMethod(e.target.value)}
                placeholder={t("settings.paymentMethodPlaceholder")}
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const v = newPaymentMethod.trim();
                    if (v && paymentMethods.length < 10) {
                      setPaymentMethods((prev) => [...prev, v]);
                      setNewPaymentMethod("");
                    }
                  }
                }}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  const v = newPaymentMethod.trim();
                  if (v && paymentMethods.length < 10) {
                    setPaymentMethods((prev) => [...prev, v]);
                    setNewPaymentMethod("");
                  }
                }}
              >
                {t("common.add")}
              </Button>
            </div>
          </div>
        </div>

        {saved && <p className="text-sm text-green-600">{t("settings.saved")}</p>}

        <Button type="submit" disabled={settingsMutation.isPending}>
          {t("common.save")}
        </Button>
      </form>
    </div>
  );
}
