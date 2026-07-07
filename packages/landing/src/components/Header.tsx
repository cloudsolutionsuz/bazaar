import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { changeLanguage } from "../i18n/i18n";
import { ADMIN_URL } from "../config";

function UBazaarLogo() {
  return (
    <svg width="140" height="44" viewBox="0 0 140 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Bag handle */}
      <path d="M14 14 C14 7 26 7 26 14" stroke="#1a5c3a" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
      {/* Bag body */}
      <path d="M6 16 Q5 16 4.5 17 L3 38 Q2.5 41 5 41.5 L35 41.5 Q37.5 41 37 38 L35.5 17 Q35 16 34 16 Z" fill="#1a5c3a"/>
      {/* White U letter */}
      <text x="20" y="37" textAnchor="middle" fontSize="18" fontWeight="900" fontFamily="Arial,sans-serif" fill="white">U</text>
      {/* Price tag */}
      <path d="M29 22 L36 17 L40 21 L35 28 Z" fill="#6abf69" opacity="0.9"/>
      <circle cx="35.5" cy="18.5" r="1.5" fill="white"/>
      {/* UBAZAAR text */}
      <text x="48" y="27" fontSize="16" fontWeight="900" fontFamily="Arial,sans-serif" fill="#1a5c3a" letterSpacing="0.5">UBAZAAR</text>
      {/* .UZ text */}
      <text x="48" y="40" fontSize="11" fontWeight="700" fontFamily="Arial,sans-serif" fill="#6abf69" letterSpacing="0.5">.UZ</text>
    </svg>
  );
}

export function Header() {
  const { t, i18n } = useTranslation();

  return (
    <header className="border-b border-brand-100 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <UBazaarLogo />
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
          <a href={ADMIN_URL} className="text-sm font-medium text-brand-700 hover:underline">
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
