import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Header } from "../components/Header";
import * as registrationApi from "../api/registration";
import { ADMIN_URL } from "../config";

type Status = "pending" | "success" | "error";

export function VerifyEmailPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("pending");
  // The verification token is single-use, but React 18 StrictMode
  // double-invokes effects in dev - without this guard the second call
  // hits an already-consumed token and overwrites the success state.
  const requestedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }
    if (requestedTokenRef.current === token) {
      return;
    }
    requestedTokenRef.current = token;

    registrationApi
      .verifyEmail(token)
      .then(() => setStatus("success"))
      .catch(() => setStatus("error"));
  }, [token]);

  return (
    <div>
      <Header />
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        {status === "pending" && <p className="text-gray-600">{t("verify.verifying")}</p>}

        {status === "success" && (
          <>
            <h1 className="mb-3 text-2xl font-bold text-brand-700">{t("verify.successTitle")}</h1>
            <p className="mb-6 text-gray-600">{t("verify.successMessage")}</p>
            <a
              href={`${ADMIN_URL}/login`}
              className="inline-block rounded-md bg-brand-600 px-6 py-3 text-sm font-medium text-white hover:bg-brand-700"
            >
              {t("verify.loginButton")}
            </a>
          </>
        )}

        {status === "error" && (
          <>
            <h1 className="mb-3 text-2xl font-bold text-red-600">{t("verify.errorTitle")}</h1>
            <p className="text-gray-600">{t("verify.errorMessage")}</p>
          </>
        )}
      </div>
    </div>
  );
}
