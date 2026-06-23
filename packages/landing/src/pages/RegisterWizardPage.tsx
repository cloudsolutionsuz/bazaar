import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "@tanstack/react-query";
import * as registrationApi from "../api/registration";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { Header } from "../components/Header";
import { ApiError } from "../api/client";

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}

function Field({ label, value, onChange, type = "text", required = false }: FieldProps) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
      />
    </div>
  );
}

function canProceed(
  step: number,
  state: { name: string; email: string; password: string; shopName: string; subdomainValid: boolean },
): boolean {
  if (step === 1) return state.name.length > 0 && state.email.includes("@") && state.password.length >= 8;
  if (step === 2) return state.shopName.length > 0;
  if (step === 3) return state.subdomainValid;
  return true;
}

export function RegisterWizardPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [shopName, setShopName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [planCode, setPlanCode] = useState(searchParams.get("plan") ?? "");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);

  const plansQuery = useQuery({ queryKey: ["plans"], queryFn: registrationApi.listPlans });
  const debouncedSubdomain = useDebouncedValue(subdomain, 400);
  const subdomainCheck = useQuery({
    queryKey: ["check-subdomain", debouncedSubdomain],
    queryFn: () => registrationApi.checkSubdomain(debouncedSubdomain),
    enabled: debouncedSubdomain.length >= 3,
  });

  const registerMutation = useMutation({
    mutationFn: registrationApi.register,
    onSuccess: () => setRegistered(true),
    onError: (err) => {
      if (err instanceof ApiError && err.code === "EMAIL_TAKEN") setSubmitError(t("register.errorEmailTaken"));
      else if (err instanceof ApiError && err.code === "SUBDOMAIN_TAKEN") setSubmitError(t("register.errorSubdomainTaken"));
      else setSubmitError(err instanceof Error ? err.message : String(err));
    },
  });

  if (registered) {
    return (
      <div>
        <Header />
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <h1 className="mb-3 text-2xl font-bold text-brand-700">{t("register.successTitle")}</h1>
          <p className="text-gray-600">{t("register.successMessage", { email })}</p>
        </div>
      </div>
    );
  }

  function handleSubmit() {
    setSubmitError(null);
    registerMutation.mutate({ name, email, phone: phone || undefined, password, shopName, subdomain, planCode });
  }

  const subdomainValid = subdomain.length >= 3 && subdomainCheck.data?.available === true;

  return (
    <div>
      <Header />
      <div className="mx-auto max-w-lg px-4 py-12">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">{t("register.title")}</h1>
        <p className="mb-6 text-sm text-gray-500">
          {t("register.step")} {step} {t("register.of")} 4
        </p>

        <div className="rounded-xl border border-brand-100 bg-white p-6">
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">{t("register.step1Title")}</h2>
              <Field label={t("register.name")} value={name} onChange={setName} required />
              <Field label={t("register.email")} type="email" value={email} onChange={setEmail} required />
              <Field label={t("register.phone")} value={phone} onChange={setPhone} />
              <Field label={t("register.password")} type="password" value={password} onChange={setPassword} required />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">{t("register.step2Title")}</h2>
              <Field label={t("register.shopName")} value={shopName} onChange={setShopName} required />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">{t("register.step3Title")}</h2>
              <Field label={t("register.subdomain")} value={subdomain} onChange={(v) => setSubdomain(v.toLowerCase())} required />
              <p className="text-sm text-gray-500">
                {t("register.subdomainHint")}: <span className="font-mono text-brand-700">{subdomain || "..."}.bazaar.uz</span>
              </p>
              {debouncedSubdomain.length >= 3 && subdomainCheck.data && (
                <p className={subdomainCheck.data.available ? "text-sm text-green-600" : "text-sm text-red-600"}>
                  {subdomainCheck.data.available ? t("register.subdomainAvailable") : t("register.subdomainTaken")}
                </p>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">{t("register.step4Title")}</h2>
              <p className="text-sm text-brand-700">{t("register.trialNotice")}</p>
              <div className="space-y-2">
                {plansQuery.data?.plans.map((plan) => (
                  <label
                    key={plan.id}
                    className={`flex cursor-pointer items-center justify-between rounded-md border px-4 py-3 ${
                      planCode === plan.code ? "border-brand-600 bg-brand-50" : "border-gray-200"
                    }`}
                  >
                    <span className="text-sm font-medium text-gray-900">{plan.name}</span>
                    <span className="text-sm text-gray-500">
                      {plan.priceSum.toLocaleString()} {t("pricing.perMonth")}
                    </span>
                    <input
                      type="radio"
                      className="hidden"
                      checked={planCode === plan.code}
                      onChange={() => setPlanCode(plan.code)}
                    />
                  </label>
                ))}
              </div>
              {submitError && <p className="text-sm text-red-600">{submitError}</p>}
            </div>
          )}

          <div className="mt-6 flex justify-between">
            {step > 1 ? (
              <button onClick={() => setStep((s) => s - 1)} className="text-sm font-medium text-gray-600 hover:underline">
                {t("register.back")}
              </button>
            ) : (
              <span />
            )}

            {step < 4 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canProceed(step, { name, email, password, shopName, subdomainValid })}
                className="rounded-md bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40"
              >
                {t("register.next")}
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!planCode || registerMutation.isPending}
                className="rounded-md bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40"
              >
                {t("register.submit")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
