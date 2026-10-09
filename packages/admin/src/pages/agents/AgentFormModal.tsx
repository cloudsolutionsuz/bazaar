import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import * as agentsApi from "../../api/agents";
import { ApiError } from "../../api/client";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { UzPhoneInput, isCompleteUzPhone, toFullUzPhone, toNationalDigits } from "../../components/ui/UzPhoneInput";
import { BonusFields, isValidBonus } from "./BonusFields";

const LOGIN_PATTERN = /^[a-z0-9._-]{3,50}$/;
const MIN_PASSWORD_LENGTH = 6;

interface AgentFormModalProps {
  open: boolean;
  // null = creating a new agent.
  agent: agentsApi.Agent | null;
  onClose: () => void;
  onSaved: () => void;
}

interface FormValues {
  fullName: string;
  phone: string;
  telegram: string;
  instagram: string;
  youtube: string;
  tiktok: string;
  login: string;
  password: string;
  bonusType: agentsApi.AgentBonusType;
  bonusValue: string;
}

function initialValues(agent: agentsApi.Agent | null): FormValues {
  return {
    fullName: agent?.fullName ?? "",
    phone: agent ? toNationalDigits(agent.phone) : "",
    telegram: agent?.telegram ?? "",
    instagram: agent?.instagram ?? "",
    youtube: agent?.youtube ?? "",
    tiktok: agent?.tiktok ?? "",
    login: agent?.login ?? "",
    password: "",
    bonusType: agent?.bonusType ?? "PERCENT",
    bonusValue: agent ? String(agent.bonusValue) : "",
  };
}

const SOCIAL_FIELDS = [
  { key: "telegram", placeholder: "@username" },
  { key: "instagram", placeholder: "https://instagram.com/…" },
  { key: "youtube", placeholder: "https://youtube.com/@…" },
  { key: "tiktok", placeholder: "https://tiktok.com/@…" },
] as const;

export function AgentFormModal({ open, agent, onClose, onSaved }: AgentFormModalProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<FormValues>(() => initialValues(agent));
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = agent !== null;

  useEffect(() => {
    if (open) {
      setValues(initialValues(agent));
      setError(null);
      setShowPassword(false);
    }
  }, [open, agent]);

  const mutation = useMutation({
    mutationFn: (input: agentsApi.AgentInput) => {
      if (!agent) return agentsApi.createAgent(input);
      // An empty password on edit means "keep the current one".
      const { password, ...rest } = input;
      return agentsApi.updateAgent(agent.id, password ? input : rest);
    },
    onSuccess: onSaved,
    onError: (err) => {
      if (err instanceof ApiError && err.code === "LOGIN_TAKEN") setError(t("agents.errorLoginTaken"));
      else setError(t("agents.errorSave"));
    },
  });

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const login = values.login.trim().toLowerCase();

    if (!isCompleteUzPhone(values.phone)) return setError(t("common.phoneHint"));
    if (!LOGIN_PATTERN.test(login)) return setError(t("agents.errorLoginFormat"));
    if ((!isEdit || values.password) && values.password.length < MIN_PASSWORD_LENGTH) return setError(t("agents.errorPassword"));
    if (!isValidBonus(values.bonusType, values.bonusValue)) return setError(t("agents.errorBonus"));

    mutation.mutate({
      fullName: values.fullName.trim(),
      phone: toFullUzPhone(values.phone),
      telegram: values.telegram.trim() || null,
      instagram: values.instagram.trim() || null,
      youtube: values.youtube.trim() || null,
      tiktok: values.tiktok.trim() || null,
      login,
      password: values.password,
      bonusType: values.bonusType,
      bonusValue: Number(values.bonusValue),
    });
  }

  const labelClass = "mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300";

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? t("agents.editAgent") : t("agents.addAgent")} closeOnBackdrop={false}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>{t("agents.fullName")}</label>
          <Input required minLength={2} maxLength={200} value={values.fullName} onChange={(e) => set("fullName", e.target.value)} className="w-full" />
        </div>

        <div>
          <label className={labelClass}>{t("agents.phone")}</label>
          <UzPhoneInput required value={values.phone} onChange={(digits) => set("phone", digits)} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {SOCIAL_FIELDS.map(({ key, placeholder }) => (
            <div key={key}>
              <label className={labelClass}>{t(`agents.${key}`)}</label>
              <Input maxLength={255} value={values[key]} onChange={(e) => set(key, e.target.value)} placeholder={placeholder} className="w-full" />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>{t("agents.login")}</label>
            <Input
              required
              autoComplete="off"
              autoCapitalize="none"
              maxLength={50}
              value={values.login}
              onChange={(e) => set("login", e.target.value)}
              className="w-full"
            />
            <p className="mt-1 text-xs text-gray-500">{t("agents.loginHint")}</p>
          </div>
          <div>
            <label className={labelClass}>{t("agents.password")}</label>
            <div className="relative">
              <Input
                required={!isEdit}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                maxLength={72}
                value={values.password}
                onChange={(e) => set("password", e.target.value)}
                className="w-full pr-20"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-800"
              >
                {showPassword ? t("common.hide") : t("common.show")}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">{isEdit ? t("agents.passwordEditHint") : t("agents.passwordHint")}</p>
          </div>
        </div>

        <BonusFields
          bonusType={values.bonusType}
          bonusValue={values.bonusValue}
          onTypeChange={(type) => set("bonusType", type)}
          onValueChange={(value) => set("bonusValue", value)}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
