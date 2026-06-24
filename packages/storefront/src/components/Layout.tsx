import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCart } from "../cart/CartContext";
import { CartDrawer } from "./CartDrawer";
import { changeLanguage } from "../i18n/i18n";
import { trackPageView } from "../api/storefront";

export function Layout() {
  const { t, i18n } = useTranslation();
  const { count } = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-sand-50">
      <header className="sticky top-0 z-30 border-b border-clay-200 bg-sand-50/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="font-display text-2xl font-bold text-clay-700">
            Bazaar
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/my-orders" className="text-sm text-clay-700 hover:underline">
              {t("myOrders.navLink")}
            </Link>
            <select
              value={i18n.language}
              onChange={(e) => changeLanguage(e.target.value as "ru" | "uz")}
              className="rounded-md border border-clay-200 bg-white px-2 py-1 text-sm text-clay-700"
            >
              <option value="ru">RU</option>
              <option value="uz">UZ</option>
            </select>
            <button
              onClick={() => setCartOpen(true)}
              className="rounded-full bg-clay-600 px-4 py-2 text-sm font-medium text-white hover:bg-clay-700"
            >
              {t("cart.title")}
              {count > 0 ? ` (${count})` : ""}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
