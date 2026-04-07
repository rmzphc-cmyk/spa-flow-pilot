import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import fr from "./fr.json";
import en from "./en.json";
import es from "./es.json";

const savedLang = localStorage.getItem("app-language") || "fr";

i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
    es: { translation: es },
  },
  lng: savedLang,
  fallbackLng: "fr",
  interpolation: { escapeValue: false },
});

// Persist language changes
i18n.on("languageChanged", (lng) => {
  localStorage.setItem("app-language", lng);
});

export default i18n;
