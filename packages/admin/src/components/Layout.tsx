import { Link, NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { changeLanguage } from "../i18n/i18n";

function navItemClass({ isActive }: { isActive: boolean }): string {
  return `block rounded-md px-3 py-2 text-sm font-medium ${isActive ? "bg-brand-50 text-brand-700" : "text-gray-600 hover:bg-gray-100"}`;
}

export function Layout() {
  const { t, i18n } = useTranslation();
  const { tenant, logout } = useAuth();
  const needsBillingAttention = tenant?.status === "PAST_DUE" || tenant?.status === "BLOCKED";

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-56 border-r border-gray-200 bg-white p-4">
        <div className="mb-6 px-2 text-lg font-semibold text-brand-700">Bazaar</div>
        <nav className="space-y-1">
          <NavLink to="/products" className={navItemClass}>
            {t("nav.products")}
          </NavLink>
          <NavLink to="/inventory" className={navItemClass}>
            {t("nav.inventory")}
          </NavLink>
          <NavLink to="/orders" className={navItemClass}>
            {t("nav.orders")}
          </NavLink>
          <NavLink to="/billing" className={navItemClass}>
            {t("nav.billing")}
          </NavLink>
        </nav>
      </aside>

      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
          <span className="text-sm font-medium text-gray-700">{tenant?.name}</span>
          <div className="flex items-center gap-3">
            <select
              value={i18n.language}
              onChange={(e) => changeLanguage(e.target.value as "ru" | "uz")}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm"
            >
              <option value="ru">RU</option>
              <option value="uz">UZ</option>
            </select>
            <button onClick={() => void logout()} className="text-sm text-gray-600 hover:text-gray-900">
              {t("nav.logout")}
            </button>
          </div>
        </header>

        {needsBillingAttention && (
          <div className="flex items-center justify-between bg-red-50 px-6 py-2 text-sm text-red-800">
            <span>{tenant?.status === "BLOCKED" ? t("billing.bannerBlocked") : t("billing.bannerPastDue")}</span>
            <Link to="/billing" className="font-medium underline">
              {t("nav.billing")}
            </Link>
          </div>
        )}

        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
