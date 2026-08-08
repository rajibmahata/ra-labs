import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n';

export default function Nav() {
  const { locale, setLocale, availableLocales, t } = useI18n();
  const location = useLocation();
  const menuOpen = useMenuOpen();
  const [localeOpen, setLocaleOpen] = useState(false);
  const localeRef = useRef<HTMLDivElement>(null);

  const currentLocale = availableLocales.find((l) => l.code === locale) ?? null;

  const isActive = (path: string): string => {
    if (path === '/#process') return location.pathname === '/' && location.hash === '#process' ? 'active' : '';
    if (path === '/') return location.pathname === '/' ? 'active' : '';
    return location.pathname.startsWith(path) ? 'active' : '';
  };

  useEffect(() => {
    if (!localeOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLocaleOpen(false);
    };
    const closeOnOutside = (event: MouseEvent) => {
      if (localeRef.current && !localeRef.current.contains(event.target as Node)) {
        setLocaleOpen(false);
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('mousedown', closeOnOutside);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('mousedown', closeOnOutside);
    };
  }, [localeOpen]);

  const closeMenu = () => menuOpen.setOpen(false);

  return (
    <header className="site-header" role="banner">
      <Link to="/" className="wordmark" aria-label="R&A Labs home">
        R&amp;A <em>Labs</em>
      </Link>

      <button
        type="button"
        className="menu-toggle"
        aria-label={menuOpen.open ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={menuOpen.open}
        aria-controls="main-navigation"
        onClick={() => menuOpen.setOpen((open) => !open)}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>

      <nav id="main-navigation" aria-label="Main navigation" className={menuOpen.open ? 'open' : ''}>
        <Link to="/work" className={isActive('/work')} onClick={closeMenu}>
          {t('nav.work', 'Work')}
        </Link>
        <Link to="/#process" className={isActive('/#process')} onClick={closeMenu}>
          {t('nav.process', 'Process')}
        </Link>
        <Link to="/team" className={isActive('/team')} onClick={closeMenu}>
          {t('nav.team', 'Team')}
        </Link>
        <Link to="/contact" className={isActive('/contact')} onClick={closeMenu}>
          {t('nav.contact', 'Contact')}
        </Link>

        <span className="badge">
          <span className="dot" aria-hidden="true" />{' '}
          {t('nav.liveAgents', 'Studio capacity available')}
        </span>

        <div className="locale-switcher" ref={localeRef}>
          <label id="locale-label">Language</label>
          <button
            type="button"
            className="locale-trigger"
            aria-haspopup="listbox"
            aria-expanded={localeOpen}
            aria-labelledby="locale-label"
            onClick={() => setLocaleOpen((open) => !open)}
          >
            <span>{currentLocale?.nativeName ?? locale.toUpperCase()}</span>
            <span className="locale-chevron" aria-hidden="true">▾</span>
          </button>
          {localeOpen && (
            <div className="locale-menu" role="listbox" aria-label="Language selector">
              {availableLocales.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  role="option"
                  aria-selected={l.code === locale}
                  onClick={() => {
                    setLocale(l.code);
                    setLocaleOpen(false);
                  }}
                >
                  <span>{l.nativeName}</span>
                  <span className="locale-code">{l.code.toUpperCase()}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </nav>
      {menuOpen.open && <button type="button" className="menu-backdrop" aria-label="Close navigation menu" onClick={closeMenu} />}
    </header>
  );
}

function useMenuOpen() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('keydown', closeOnEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = '';
    };
  }, [open]);

  return { open, setOpen };
}
