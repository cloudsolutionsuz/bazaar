import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { resetPassword } from "../api/auth";
import { ApiError } from "../api/client";

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

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError(t("resetPassword.mismatch"));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await resetPassword(token, password);
      navigate("/login?reset=1", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("resetPassword.error"));
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <p className="mb-4 text-sm text-red-600">{t("resetPassword.invalidLink")}</p>
          <Link to="/login" className="text-sm text-brand-600 hover:underline">{t("forgotPassword.backToLogin")}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-gray-200 bg-white px-8 pb-8 pt-6 shadow-sm dark:border-gray-700 dark:bg-gray-900"
      >
        <h1 className="mb-4 text-center text-lg font-semibold text-gray-800 dark:text-gray-100">
          {t("resetPassword.title")}
        </h1>

        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t("resetPassword.newPassword")}
        </label>
        <div className="relative mb-4">
          <input
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
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

        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t("resetPassword.confirmPassword")}
        </label>
        <input
          type={showPassword ? "text" : "password"}
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="mb-4 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {t("resetPassword.submit")}
        </button>
      </form>
    </div>
  );
}
