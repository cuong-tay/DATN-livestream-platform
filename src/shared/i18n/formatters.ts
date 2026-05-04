import { useMemo } from "react";
import { useI18n } from "./I18nContext";
import type { LanguageCode } from "./translations";

const localeByLanguage: Record<LanguageCode, string> = {
  vi: "vi-VN",
  en: "en-US",
  es: "es-ES",
};

const defaultCurrencyByLanguage: Record<LanguageCode, string> = {
  vi: "VND",
  en: "USD",
  es: "EUR",
};

type DateInput = Date | string | number | null | undefined;

export function getLocale(language: LanguageCode): string {
  return localeByLanguage[language] ?? localeByLanguage.vi;
}

export function formatLocalizedNumber(
  value: number | null | undefined,
  language: LanguageCode,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(getLocale(language), options).format(value ?? 0);
}

export function formatLocalizedCurrency(
  value: number | null | undefined,
  language: LanguageCode,
  currency = defaultCurrencyByLanguage[language],
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(getLocale(language), {
    style: "currency",
    currency,
    ...options,
  }).format(value ?? 0);
}

export function formatLocalizedDate(
  value: DateInput,
  language: LanguageCode,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(getLocale(language), options).format(date);
}

export function useI18nFormatters() {
  const { language } = useI18n();

  return useMemo(
    () => ({
      formatNumber: (value: number | null | undefined, options?: Intl.NumberFormatOptions) =>
        formatLocalizedNumber(value, language, options),
      formatCurrency: (
        value: number | null | undefined,
        currency?: string,
        options?: Intl.NumberFormatOptions,
      ) => formatLocalizedCurrency(value, language, currency, options),
      formatDate: (value: DateInput, options?: Intl.DateTimeFormatOptions) =>
        formatLocalizedDate(value, language, options),
    }),
    [language],
  );
}
