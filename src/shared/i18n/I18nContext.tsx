import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  SUPPORTED_LANGUAGES,
  translations,
  type LanguageCode,
  type TranslationKey,
} from "./translations";

type TranslationParams = Record<string, string | number>;

interface I18nContextProps {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: TranslationKey, params?: TranslationParams) => string;
}

const I18nContext = createContext<I18nContextProps | undefined>(undefined);

function isLanguageCode(value: string | null | undefined): value is LanguageCode {
  return Boolean(value && SUPPORTED_LANGUAGES.includes(value as LanguageCode));
}

function resolveInitialLanguage(): LanguageCode {
  const saved = localStorage.getItem("app_lang");
  if (isLanguageCode(saved)) {
    return saved;
  }

  const browserLanguage = navigator.language.split("-")[0];
  return isLanguageCode(browserLanguage) ? browserLanguage : "vi";
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = params[key];
    return value === undefined ? match : String(value);
  });
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(resolveInitialLanguage);

  const setLanguage = (lang: LanguageCode) => {
    setLanguageState(lang);
    localStorage.setItem("app_lang", lang);
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<I18nContextProps>(() => {
    const t = (key: TranslationKey, params?: TranslationParams): string => {
      const template = translations[language][key] ?? translations.en[key] ?? key;
      return interpolate(template, params);
    };

    return { language, setLanguage, t };
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}
