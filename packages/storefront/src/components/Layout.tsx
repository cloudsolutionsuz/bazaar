import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useCart } from "../cart/CartContext";
import { CartDrawer } from "./CartDrawer";
import { changeLanguage } from "../i18n/i18n";
import { getMeta, trackPageView } from "../api/storefront";

export function Layout() {
  const { t, i18n } = useTranslation();
  const { count } = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const location = useLocation();
  const metaQuery = useQuery({ queryKey: ["tenant-meta"], queryFn: getMeta });
  const meta = metaQuery.data;
  const accentStyle = meta?.themeColor ? { backgroundColor: meta.themeColor } : undefined;

  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-sand-50">
      <header className="sticky top-0 z-30 border-b border-clay-200 bg-sand-50/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-y-2 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold text-clay-700 sm:text-xl">
            {meta?.logoUrl ? (
              <img
                src={meta.logoUrl}
                alt={meta.name}
                className="h-10 w-auto max-w-[140px] rounded-lg object-contain sm:h-12 sm:max-w-[180px]"
              />
            ) : null}
            <span>{meta?.name ?? "Bazaar"}</span>
          </Link>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Link to="/my-orders" className="text-sm text-clay-700 hover:underline">
              {t("myOrders.navLink")}
            </Link>
            <Link to="/chat" className="text-sm text-clay-700 hover:underline">
              {t("chat.navLink")}
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
              style={accentStyle}
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

      {meta && (meta.companyName || meta.inn || meta.contactPhone || meta.instagram || meta.facebook || meta.youtube) && (
        <footer className="mt-8 border-t border-clay-200 bg-white py-6">
          <div className="mx-auto max-w-5xl px-4 text-sm text-gray-600">
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              {(meta.companyName || meta.inn) && (
                <div>
                  {meta.companyName && <span className="font-medium">{meta.companyName}</span>}
                  {meta.inn && <span className="ml-2 text-gray-400">{t("footer.inn")}: {meta.inn}</span>}
                </div>
              )}
              {meta.contactPhone && (
                <a href={`tel:${meta.contactPhone}`} className="hover:text-clay-700">
                  {meta.contactPhone}
                </a>
              )}
              {(meta.instagram || meta.facebook || meta.youtube) && (
                <div className="flex items-center gap-3">
                  {meta.instagram && (
                    <a href={meta.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-clay-700">
                      Instagram
                    </a>
                  )}
                  {meta.facebook && (
                    <a href={meta.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-clay-700">
                      Facebook
                    </a>
                  )}
                  {meta.youtube && (
                    <a href={meta.youtube} target="_blank" rel="noopener noreferrer" className="hover:text-clay-700">
                      YouTube
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
