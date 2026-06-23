import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ru from "./locales/ru.json";
import uz from "./locales/uz.json";

const LANGUAGE_KEY = "bazaar_storefront_lang";

void i18n.use(initReactI18next).init({
  resources: { ru: { translation: ru }, uz: { translation: uz } },
  lng: localStorage.getItem(LANGUAGE_KEY) ?? "ru",
  fallbackLng: "ru",
  interpolation: { escapeValue: false },
});

export function changeLanguage(lang: "ru" | "uz"): void {
  localStorage.setItem(LANGUAGE_KEY, lang);
  void i18n.changeLanguage(lang);
}

export default i18n;
