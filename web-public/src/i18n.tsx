import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { api, type LocaleInfo } from './api/client';
import { getFromStorage, setToStorage } from './api/client';

// Supported locales with fallback names
const FALLBACK_LOCALES: LocaleInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
];

const DEFAULT_LOCALE = 'en';
const LOCALE_STORAGE_KEY = 'locale';

interface I18nContextValue {
  locale: string;
  setLocale: (locale: string) => void;
  content: Record<string, string> | null;
  loading: boolean;
  error: string | null;
  availableLocales: LocaleInfo[];
  t: (key: string, fallback?: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function detectBrowserLocale(): string {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE;

  const stored = getFromStorage(LOCALE_STORAGE_KEY);
  if (stored) return stored;

  const browserLang = navigator.language?.split('-')[0] ?? DEFAULT_LOCALE;

  const match = FALLBACK_LOCALES.find((l) => l.code === browserLang);
  return match ? match.code : DEFAULT_LOCALE;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<string>(detectBrowserLocale);
  const [content, setContent] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableLocales, setAvailableLocales] =
    useState<LocaleInfo[]>(FALLBACK_LOCALES);

  // Fetch available locales
  useEffect(() => {
    let cancelled = false;

    api
      .getLocales()
      .then((res) => {
        if (!cancelled && res.data && res.data.length > 0) {
          setAvailableLocales(res.data);
        }
      })
      .catch(() => {
        // Use fallback locales — silently
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch content for current locale
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .getContent(locale)
      .then((res) => {
        if (!cancelled) {
          setContent(res.data.content);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setContent(null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [locale]);

  const setLocale = useCallback((newLocale: string) => {
    setToStorage(LOCALE_STORAGE_KEY, newLocale);
    setLocaleState(newLocale);
  }, []);

  const t = useCallback(
    (key: string, fallback?: string): string => {
      if (content?.[key]) return content[key];
      if (fallback !== undefined) return fallback;
      return key;
    },
    [content]
  );

  const value: I18nContextValue = {
    locale,
    setLocale,
    content,
    loading,
    error,
    availableLocales,
    t,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return ctx;
}
