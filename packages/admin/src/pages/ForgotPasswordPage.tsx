import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { forgotPassword } from "../api/auth";

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white px-8 pb-8 pt-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h1 className="mb-2 text-center text-lg font-semibold text-gray-800 dark:text-gray-100">
          {t("forgotPassword.title")}
        </h1>

        {sent ? (
          <div className="mt-4 text-center">
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              {t("forgotPassword.sent")}
            </p>
            <Link to="/login" className="text-sm text-brand-600 hover:underline dark:text-brand-400">
              {t("forgotPassword.backToLogin")}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="mb-4 text-center text-sm text-gray-500 dark:text-gray-400">
              {t("forgotPassword.hint")}
            </p>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("login.email")}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mb-4 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
            <button
              type="submit"
              disabled={submitting}
              className="mb-3 w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {t("forgotPassword.submit")}
            </button>
            <div className="text-center">
              <Link to="/login" className="text-xs text-gray-500 hover:underline dark:text-gray-400">
                {t("forgotPassword.backToLogin")}
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
