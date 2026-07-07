import { useState, useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { changeLanguage } from "../i18n/i18n";
import { useTheme } from "../context/ThemeContext";

function navItemClass({ isActive }: { isActive: boolean }): string {
  return `block rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap ${
    isActive
      ? "bg-brand-50 text-brand-700 dark:bg-brand-700/20 dark:text-brand-300"
      : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/60"
  }`;
}

const STAFF_AND_MANAGEMENT_ROLES = new Set(["OWNER", "MANAGER"]);
const ALL_STAFF_ROLES = new Set(["OWNER", "MANAGER", "CASHIER"]);

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
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

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

export function Layout() {
  const { t, i18n } = useTranslation();
  const { user, tenant, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const needsBillingAttention = tenant?.status === "PAST_DUE" || tenant?.status === "BLOCKED";
  const role = user?.role ?? "";

  const [sidebarOpen, setSidebarOpen] = useState(() => {
    // On small screens, default to closed so content isn't overlaid on first load
    if (typeof window !== "undefined" && window.innerWidth < 1024) return false;
    return localStorage.getItem("bazaar-sidebar") !== "closed";
  });

  // Persist desktop state; mobile state is session-only (always starts closed)
  useEffect(() => {
    if (window.innerWidth >= 1024) {
      localStorage.setItem("bazaar-sidebar", sidebarOpen ? "open" : "closed");
    }
  }, [sidebarOpen]);

  // Auto-close mobile sidebar on navigation
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Mobile backdrop — shown when sidebar is open on small screens */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar
          Mobile  (<lg): fixed overlay, slides in/out via translateX
          Desktop (≥lg): inline flex item, opens/closes via width          */}
      <aside
        className={[
          // Base — always fixed on mobile, static on desktop
          "fixed inset-y-0 left-0 z-50 w-56 shrink-0 overflow-hidden",
          "border-r border-gray-200 bg-white",
          "dark:border-gray-700 dark:bg-gray-900",
          // Both transitions at once: transform for mobile, width for desktop
          "transition-[transform,width] duration-200 ease-in-out",
          // Desktop overrides
          "lg:static lg:z-auto",
          sidebarOpen
            ? "translate-x-0 lg:w-56"
            : "-translate-x-full lg:translate-x-0 lg:w-0",
        ].join(" ")}
      >
        {/* Inner div is always 224px so content never reflows during animation */}
        <div className="flex h-full w-56 flex-col p-4">
          <div className="mb-6 px-2 text-lg font-semibold text-brand-700 dark:text-brand-400">Bazaar</div>
          <nav className="flex-1 space-y-1 overflow-y-auto">
            {STAFF_AND_MANAGEMENT_ROLES.has(role) && (
              <>
                <NavLink to="/dashboard" className={navItemClass}>{t("nav.dashboard")}</NavLink>
                <NavLink to="/products" className={navItemClass}>{t("nav.products")}</NavLink>
                <NavLink to="/categories" className={navItemClass}>{t("nav.categories")}</NavLink>
                <NavLink to="/inventory" className={navItemClass}>{t("nav.inventory")}</NavLink>
                <NavLink to="/suppliers" className={navItemClass}>{t("nav.suppliers")}</NavLink>
                <NavLink to="/banners" className={navItemClass}>{t("nav.banners")}</NavLink>
                <NavLink to="/promotions" className={navItemClass}>{t("nav.promotions")}</NavLink>
                <NavLink to="/promo-codes" className={navItemClass}>{t("nav.promoCodes")}</NavLink>
                <NavLink to="/reviews" className={navItemClass}>{t("nav.reviews")}</NavLink>
                <NavLink to="/delivery-zones" className={navItemClass}>{t("nav.deliveryZones")}</NavLink>
                <NavLink to="/customers" className={navItemClass}>{t("nav.customers")}</NavLink>
              </>
            )}
            {ALL_STAFF_ROLES.has(role) && (
              <>
                <NavLink to="/orders" className={navItemClass}>{t("nav.orders")}</NavLink>
                <NavLink to="/chat" className={navItemClass}>{t("nav.chat")}</NavLink>
              </>
            )}
            {STAFF_AND_MANAGEMENT_ROLES.has(role) && (
              <>
                <NavLink to="/kassa" className={navItemClass}>{t("nav.kassa")}</NavLink>
                <NavLink to="/reports" className={navItemClass}>{t("nav.reports")}</NavLink>
                <NavLink to="/ai-advisor" className={navItemClass}>{t("nav.aiAdvisor")}</NavLink>
                <NavLink to="/billing" className={navItemClass}>{t("nav.billing")}</NavLink>
              </>
            )}
            {role === "OWNER" && (
              <>
                <NavLink to="/employees" className={navItemClass}>{t("nav.employees")}</NavLink>
                <NavLink to="/settings" className={navItemClass}>{t("nav.settings")}</NavLink>
              </>
            )}
            {role === "SUPER_ADMIN" && (
              <>
                <NavLink to="/platform/tenants" className={navItemClass}>{t("nav.tenants")}</NavLink>
                <NavLink to="/platform/plans" className={navItemClass}>{t("nav.plans")}</NavLink>
                <NavLink to="/platform/billing-timeline" className={navItemClass}>{t("nav.billingTimeline")}</NavLink>
                <NavLink to="/platform/video-banners" className={navItemClass}>{t("nav.videoBanners")}</NavLink>
              </>
            )}
          </nav>
        </div>
      </aside>

      {/* Main content — full width on mobile (sidebar is overlaid) */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-3 py-3 sm:px-4 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              title={sidebarOpen ? "Скрыть меню" : "Показать меню"}
              className="shrink-0 rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <MenuIcon />
            </button>
            <span className="truncate text-sm font-medium text-gray-700 dark:text-gray-300">
              {tenant?.name}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
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
              className="hidden text-sm text-gray-600 hover:text-gray-900 sm:block dark:text-gray-400 dark:hover:text-gray-100"
            >
              {t("nav.logout")}
            </button>
            {/* Logout icon-only on very small screens */}
            <button
              onClick={() => void logout()}
              title={t("nav.logout")}
              className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 sm:hidden dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </header>

        {needsBillingAttention && STAFF_AND_MANAGEMENT_ROLES.has(role) && (
          <div className="flex shrink-0 items-center justify-between bg-red-50 px-3 py-2 text-sm text-red-800 sm:px-6 dark:bg-red-900/20 dark:text-red-300">
            <span className="truncate">{tenant?.status === "BLOCKED" ? t("billing.bannerBlocked") : t("billing.bannerPastDue")}</span>
            <Link to="/billing" className="ml-3 shrink-0 font-medium underline">{t("nav.billing")}</Link>
          </div>
        )}

        {/* p-3 on mobile, p-6 on sm+ */}
        <main className="flex-1 p-3 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
