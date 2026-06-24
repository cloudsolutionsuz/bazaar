import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import * as tenantsApi from "../api/tenants";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";

export function SettingsPage() {
  const { t } = useTranslation();
  const { tenant } = useAuth();
  const [telegramChatId, setTelegramChatId] = useState(tenant?.telegramChatId ?? "");
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: (value: string) => tenantsApi.updateMySettings(value || null),
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate(telegramChatId);
  }

  return (
    <div className="max-w-md">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">{t("settings.title")}</h1>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("settings.telegramChatId")}</label>
          <Input value={telegramChatId} onChange={(e) => setTelegramChatId(e.target.value)} className="w-full" />
          <p className="mt-1 text-xs text-gray-500">{t("settings.telegramChatIdHint")}</p>
        </div>

        {saved && <p className="text-sm text-green-600">{t("settings.saved")}</p>}

        <Button type="submit" disabled={mutation.isPending}>
          {t("common.save")}
        </Button>
      </form>
    </div>
  );
}
