'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { translations, type Locale, type TranslationKey } from './i18n';

const STORAGE_KEY = 'ck-locale';
const DEFAULT_LOCALE: Locale = 'en';

type TranslationFunction = (key: TranslationKey) => string;

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslationFunction;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined
);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [mounted, setMounted] = useState(false);

  // Load saved locale from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (saved && (saved === 'th' || saved === 'en')) {
        setLocaleState(saved);
      }
    } catch {
      // localStorage unavailable — keep default
    }
    setMounted(true);
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
    } catch {
      // localStorage unavailable — silent fail
    }
  }, []);

  const t: TranslationFunction = useCallback(
    (key: TranslationKey) => {
      const value = translations[locale]?.[key];
      if (value !== undefined) return value;
      // Fallback to English, then return the key itself
      const fallback = translations.en?.[key];
      return fallback !== undefined ? fallback : key;
    },
    [locale]
  );

  // Prevent hydration mismatch: render with default locale until mounted
  const contextValue: LanguageContextValue = {
    locale: mounted ? locale : DEFAULT_LOCALE,
    setLocale,
    t: mounted
      ? t
      : (key: TranslationKey) => translations[DEFAULT_LOCALE]?.[key] ?? key,
  };

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

/** Shorthand hook that returns only the translation function */
export function useT(): TranslationFunction {
  return useLanguage().t;
}
