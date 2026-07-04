import { Link, NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { changeLanguage } from "../i18n/i18n";
import { useTheme } from "../context/ThemeContext";

function navItemClass({ isActive }: { isActive: boolean }): string {
  return `block rounded-md px-3 py-2 text-sm font-medium ${
    isActive
      ? "bg-brand-50 text-brand-700 dark:bg-brand-700/20 dark:text-brand-300"
      : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/60"
  }`;
}

// Mirrors each module's actual requireRole() on the backend - kept here
// only so the nav doesn't dangle links that would 403, not as the real
// access control (the backend enforces that independently).
const STAFF_AND_MANAGEMENT_ROLES = new Set(["OWNER", "MANAGER"]);
const ALL_STAFF_ROLES = new Set(["OWNER", "MANAGER", "CASHIER"]);

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export function Layout() {
  const { t, i18n } = useTranslation();
  const { user, tenant, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const needsBillingAttention = tenant?.status === "PAST_DUE" || tenant?.status === "BLOCKED";
  const role = user?.role ?? "";

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <aside className="w-56 shrink-0 border-r border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-6 px-2 text-lg font-semibold text-brand-700 dark:text-brand-400">Bazaar</div>
        <nav className="space-y-1">
          {STAFF_AND_MANAGEMENT_ROLES.has(role) && (
            <>
              <NavLink to="/dashboard" className={navItemClass}>
                {t("nav.dashboard")}
              </NavLink>
              <NavLink to="/products" className={navItemClass}>
                {t("nav.products")}
              </NavLink>
              <NavLink to="/categories" className={navItemClass}>
                {t("nav.categories")}
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
              <NavLink to="/promotions" className={navItemClass}>
                {t("nav.promotions")}
              </NavLink>
              <NavLink to="/promo-codes" className={navItemClass}>
                {t("nav.promoCodes")}
              </NavLink>
              <NavLink to="/reviews" className={navItemClass}>
                {t("nav.reviews")}
              </NavLink>
              <NavLink to="/delivery-zones" className={navItemClass}>
                {t("nav.deliveryZones")}
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

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 py-3 dark:border-gray-700 dark:bg-gray-900">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{tenant?.name}</span>
          <div className="flex items-center gap-3">
            <button
              onClick={toggle}
              title={theme === "dark" ? "Светлый режим" : "Тёмный режим"}
              className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
            <select
              value={i18n.language}
              onChange={(e) => changeLanguage(e.target.value as "ru" | "uz")}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
            >
              <option value="ru">RU</option>
              <option value="uz">UZ</option>
            </select>
            <button
              onClick={() => void logout()}
              className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              {t("nav.logout")}
            </button>
          </div>
        </header>

        {needsBillingAttention && STAFF_AND_MANAGEMENT_ROLES.has(role) && (
          <div className="flex shrink-0 items-center justify-between bg-red-50 px-6 py-2 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300">
            <span>{tenant?.status === "BLOCKED" ? t("billing.bannerBlocked") : t("billing.bannerPastDue")}</span>
            <Link to="/billing" className="font-medium underline">
              {t("nav.billing")}
            </Link>
          </div>
        )}

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
