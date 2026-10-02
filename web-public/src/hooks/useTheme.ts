import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'ralabs-theme';
type Theme = 'dark' | 'light';

function getStoredTheme(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch { /* noop */ }
  return null;
}

function setStoredTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch { /* noop */ }
}

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      theme === 'dark' ? '#030b12' : '#f5f8f5'
    );
  } catch { /* noop */ }
}

function resolveDefaultTheme(): Theme {
  const stored = getStoredTheme();
  if (stored) return stored;
  if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light';
  return 'dark';
}

const THEME_ICONS: Record<Theme, string> = { dark: '\u263E', light: '\u2600' };

export function useTheme(): [Theme, () => void, string] {
  const [theme, setThemeState] = useState<Theme>(resolveDefaultTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setThemeState((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      setStoredTheme(next);
      return next;
    });
  }, []);

  return [theme, toggle, THEME_ICONS[theme]];
}
