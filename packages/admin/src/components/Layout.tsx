import { Link, NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { changeLanguage } from "../i18n/i18n";

function navItemClass({ isActive }: { isActive: boolean }): string {
  return `block rounded-md px-3 py-2 text-sm font-medium ${isActive ? "bg-brand-50 text-brand-700" : "text-gray-600 hover:bg-gray-100"}`;
}

// Mirrors each module's actual requireRole() on the backend - kept here
// only so the nav doesn't dangle links that would 403, not as the real
// access control (the backend enforces that independently).
const STAFF_AND_MANAGEMENT_ROLES = new Set(["OWNER", "MANAGER"]);
const ALL_STAFF_ROLES = new Set(["OWNER", "MANAGER", "CASHIER"]);

export function Layout() {
  const { t, i18n } = useTranslation();
  const { user, tenant, logout } = useAuth();
  const needsBillingAttention = tenant?.status === "PAST_DUE" || tenant?.status === "BLOCKED";
  const role = user?.role ?? "";

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-56 border-r border-gray-200 bg-white p-4">
        <div className="mb-6 px-2 text-lg font-semibold text-brand-700">Bazaar</div>
        <nav className="space-y-1">
          {STAFF_AND_MANAGEMENT_ROLES.has(role) && (
            <>
              <NavLink to="/dashboard" className={navItemClass}>
                {t("nav.dashboard")}
              </NavLink>
              <NavLink to="/products" className={navItemClass}>
                {t("nav.products")}
              </NavLink>
              <NavLink to="/inventory" className={navItemClass}>
                {t("nav.inventory")}
              </NavLink>
              <NavLink to="/suppliers" className={navItemClass}>
                {t("nav.suppliers")}
              </NavLink>
              <NavLink to="/banners" className={navItemClass}>
                {t("nav.banners")}
              </NavLink>
              <NavLink to="/customers" className={navItemClass}>
                {t("nav.customers")}
              </NavLink>
            </>
          )}
          {ALL_STAFF_ROLES.has(role) && (
            <>
              <NavLink to="/orders" className={navItemClass}>
                {t("nav.orders")}
              </NavLink>
              <NavLink to="/chat" className={navItemClass}>
                {t("nav.chat")}
              </NavLink>
            </>
          )}
          {STAFF_AND_MANAGEMENT_ROLES.has(role) && (
            <>
              <NavLink to="/kassa" className={navItemClass}>
                {t("nav.kassa")}
              </NavLink>
              <NavLink to="/reports" className={navItemClass}>
                {t("nav.reports")}
              </NavLink>
              <NavLink to="/ai-advisor" className={navItemClass}>
                {t("nav.aiAdvisor")}
              </NavLink>
              <NavLink to="/billing" className={navItemClass}>
                {t("nav.billing")}
              </NavLink>
            </>
          )}
          {role === "OWNER" && (
            <>
              <NavLink to="/employees" className={navItemClass}>
                {t("nav.employees")}
              </NavLink>
              <NavLink to="/settings" className={navItemClass}>
                {t("nav.settings")}
              </NavLink>
            </>
          )}
          {role === "SUPER_ADMIN" && (
            <>
              <NavLink to="/platform/tenants" className={navItemClass}>
                {t("nav.tenants")}
              </NavLink>
              <NavLink to="/platform/plans" className={navItemClass}>
                {t("nav.plans")}
              </NavLink>
              <NavLink to="/platform/billing-timeline" className={navItemClass}>
                {t("nav.billingTimeline")}
              </NavLink>
            </>
          )}
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

        {needsBillingAttention && STAFF_AND_MANAGEMENT_ROLES.has(role) && (
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
