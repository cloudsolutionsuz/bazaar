import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { changeLanguage } from "../i18n/i18n";
import { ADMIN_URL } from "../config";

export function Header() {
  const { t, i18n } = useTranslation();

  return (
    <header className="border-b border-brand-100 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link to="/" className="text-2xl font-bold text-brand-700">
          Bazaar
        </Link>
        <div className="flex items-center gap-4">
          <select
            value={i18n.language}
            onChange={(e) => changeLanguage(e.target.value as "ru" | "uz")}
            className="rounded-md border border-brand-200 px-2 py-1 text-sm text-brand-700"
          >
            <option value="ru">RU</option>
            <option value="uz">UZ</option>
          </select>
          <a href={`${ADMIN_URL}/login`} className="text-sm font-medium text-brand-700 hover:underline">
            {t("nav.login")}
          </a>
          <Link to="/register" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            {t("nav.getStarted")}
          </Link>
        </div>
      </div>
    </header>
  );
}
