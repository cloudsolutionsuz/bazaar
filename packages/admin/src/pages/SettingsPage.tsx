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
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const settingsMutation = useMutation({
    mutationFn: () =>
      tenantsApi.updateMySettings({
        telegramChatId: telegramChatId || null,
        themeColor: themeColor || null,
        description: description || null,
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

        {saved && <p className="text-sm text-green-600">{t("settings.saved")}</p>}

        <Button type="submit" disabled={settingsMutation.isPending}>
          {t("common.save")}
        </Button>
      </form>
    </div>
  );
}
