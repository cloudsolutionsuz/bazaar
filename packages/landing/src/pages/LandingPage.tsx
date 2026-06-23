import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Header } from "../components/Header";
import * as registrationApi from "../api/registration";

const FEATURE_KEYS = ["products", "inventory", "orders", "storefront", "analytics", "finance"] as const;

export function LandingPage() {
  const { t } = useTranslation();
  const plansQuery = useQuery({ queryKey: ["plans"], queryFn: registrationApi.listPlans });

  return (
    <div>
      <Header />

      <section className="bg-brand-50">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center">
          <h1 className="text-4xl font-bold text-brand-900 sm:text-5xl">{t("hero.title")}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-brand-800/80">{t("hero.subtitle")}</p>
          <Link
            to="/register"
            className="mt-8 inline-block rounded-md bg-brand-600 px-8 py-3 text-base font-semibold text-white hover:bg-brand-700"
          >
            {t("hero.cta")}
          </Link>
          <p className="mt-3 text-sm text-brand-700">{t("hero.trialNote")}</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="mb-10 text-center text-3xl font-bold text-gray-900">{t("features.title")}</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURE_KEYS.map((key) => (
            <div key={key} className="rounded-xl border border-brand-100 p-6">
              <h3 className="mb-2 text-lg font-semibold text-brand-700">{t(`features.${key}.title`)}</h3>
              <p className="text-sm text-gray-600">{t(`features.${key}.description`)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-brand-900 py-16 text-white">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-10 text-center text-3xl font-bold">{t("pricing.title")}</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {plansQuery.data?.plans.map((plan) => (
              <div key={plan.id} className="rounded-xl border border-brand-700 bg-brand-800 p-6">
                <h3 className="text-xl font-semibold">{plan.name}</h3>
                <div className="mt-2 text-3xl font-bold">{plan.priceSum.toLocaleString()}</div>
                <div className="text-sm text-brand-200">{t("pricing.perMonth")}</div>
                <ul className="mt-4 space-y-1 text-sm text-brand-100">
                  <li>
                    {plan.maxProducts ?? t("pricing.unlimited")} {t("pricing.products")}
                  </li>
                  <li>
                    {plan.maxOrdersPerMonth ?? t("pricing.unlimited")} {t("pricing.ordersPerMonth")}
                  </li>
                  <li>
                    {plan.maxEmployees ?? t("pricing.unlimited")} {t("pricing.employees")}
                  </li>
                </ul>
                <Link
                  to={`/register?plan=${plan.code}`}
                  className="mt-6 block rounded-md bg-white px-4 py-2 text-center text-sm font-semibold text-brand-800 hover:bg-brand-50"
                >
                  {t("pricing.choosePlan")}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
