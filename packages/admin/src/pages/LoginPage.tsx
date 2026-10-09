import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api/client";

function UBazaarLogo() {
  return (
    <div className="mb-6 flex flex-col items-center gap-2">
      <svg width="72" height="80" viewBox="0 0 90 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M30 32 C30 18 60 18 60 32" stroke="#19654f" strokeWidth="6" strokeLinecap="round" fill="none"/>
        <path d="M10 36 Q8 36 7 38 L4 88 Q3 94 9 95 L81 95 Q87 94 86 88 L83 38 Q82 36 80 36 Z" fill="#19654f"/>
        <text x="45" y="79" textAnchor="middle" fontSize="42" fontWeight="900" fontFamily="Arial, sans-serif" fill="white" letterSpacing="-1">U</text>
        <circle cx="67" cy="54" r="7" fill="#6abf8e"/>
        <line x1="67" y1="47" x2="73" y2="41" stroke="#6abf8e" strokeWidth="2.5" strokeLinecap="round"/>
        <circle cx="71" cy="43" r="2" fill="white"/>
      </svg>
      <div className="flex items-baseline gap-0.5 text-2xl font-black tracking-wide">
        <span className="text-brand-700">UBAZAAR</span>
        <span className="text-green-400">.UZ</span>
      </div>
    </div>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

export function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate("/", { replace: true });
    } catch (err) {
      // Only a real "wrong credentials" answer gets that message - a blocked
      // shop or an unverified email must say so.
      if (!(err instanceof ApiError)) setError(t("common.error"));
      else if (err.code === "AGENT_DISABLED") setError(t("login.errorDisabled"));
      else if (err.code === "INVALID_CREDENTIALS") setError(t("login.error"));
      else setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-gray-200 bg-white px-8 pb-8 pt-6 shadow-sm dark:border-gray-700 dark:bg-gray-900"
      >
        <UBazaarLogo />

        <h1 className="mb-6 text-center text-lg font-semibold text-gray-700 dark:text-gray-300">
          {t("login.title")}
        </h1>

        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t("login.email")}
        </label>
        <input
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />

        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t("login.password")}
        </label>
        <div className="relative mb-2">
          <input
            type={showPassword ? "text" : "password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 pr-10 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <EyeIcon open={showPassword} />
          </button>
        </div>

        <div className="mb-4 text-right">
          <Link to="/forgot-password" className="text-xs text-brand-600 hover:underline dark:text-brand-400">
            {t("login.forgotPassword")}
          </Link>
        </div>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {t("login.submit")}
        </button>
      </form>
    </div>
  );
}
