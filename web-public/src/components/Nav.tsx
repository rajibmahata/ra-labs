import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useTheme } from '../hooks/useTheme';

export default function Nav() {
  const { locale, setLocale, availableLocales, t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const menuOpen = useMenuOpen();
  const [localeOpen, setLocaleOpen] = useState(false);
  const localeRef = useRef<HTMLDivElement>(null);
  const [theme, toggleTheme, themeIcon] = useTheme();

  const currentLocale = availableLocales.find((l) => l.code === locale) ?? null;

  const isActive = (path: string): string => {
    if (path === '/#services') return location.pathname === '/' && location.hash === '#services' ? 'active' : '';
    if (path === '/#journey') return location.pathname === '/' && location.hash === '#journey' ? 'active' : '';
    if (path === '/') return location.pathname === '/' ? 'active' : '';
    return location.pathname.startsWith(path) ? 'active' : '';
  };

  const goToHomeSection = (hash: string) => {
    if (location.pathname === '/') {
      const el = document.querySelector(hash);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }
    navigate('/');
    setTimeout(() => {
      const el = document.querySelector(hash);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const scrollToAgent = () => {
    if (location.pathname === '/') {
      const el = document.querySelector('.hero-agent-wrapper');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }
    navigate('/agent');
  };

  const handleNavClick = (hash: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    closeMenu();
    goToHomeSection(hash);
  };

  const closeMenu = () => menuOpen.setOpen(false);

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

  const navLinks = (
    <>
      <Link to="/agent" className={isActive('/agent')} onClick={closeMenu}>
        {t('nav.agent', 'AI Agent')}
      </Link>
      <Link to="/work" className={isActive('/work')} onClick={closeMenu}>
        {t('nav.work', 'Work')}
      </Link>
      <a href="#services" className={isActive('/#services')} onClick={handleNavClick('#services')}>
        {t('nav.services', 'Services')}
      </a>
      <a href="#journey" className={isActive('/#journey')} onClick={handleNavClick('#journey')}>
        {t('nav.process', 'Process')}
      </a>
      <Link to="/team" className={isActive('/team')} onClick={closeMenu}>
        {t('nav.team', 'Team')}
      </Link>
      <Link to="/contact" className={isActive('/contact')} onClick={closeMenu}>
        {t('nav.contact', 'Contact')}
      </Link>
    </>
  );

  const mobileExtraItems = (
    <>
      <span className="badge mobile-badge">
        <span className="dot" aria-hidden="true" />{' '}
        {t('nav.liveAgents', 'Studio capacity: Available')}
      </span>
      <button
        type="button"
        className="theme-toggle mobile-theme"
        aria-label={t('nav.theme.switch', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme')}
        onClick={toggleTheme}
      >
        {themeIcon}
      </button>
      <button type="button" className="nav-start-cta mobile-cta" onClick={() => { closeMenu(); scrollToAgent(); }}>
        {t('nav.startProject', 'Start a Project')} &rarr;
      </button>
      <LocaleSwitcher
        locale={locale}
        setLocale={setLocale}
        availableLocales={availableLocales}
        currentLocale={currentLocale}
        localeOpen={localeOpen}
        setLocaleOpen={setLocaleOpen}
        localeRef={localeRef}
      />
    </>
  );

  return (
    <header className="site-header" role="banner">
      <Link to="/" className="wordmark" aria-label="R&A Labs home">
        R&amp;A <em>Labs</em>
        <span className="logo-tagline">AI &middot; ENGINEERING STUDIO</span>
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
        {navLinks}
        {mobileExtraItems}
      </nav>

      <div className="navright">
        <div className="nav-status">
          <span className="status-dot" aria-hidden="true" />
          {t('nav.liveAgents', 'Studio capacity: Available')}
        </div>
        <button
          type="button"
          className="theme-toggle"
          aria-label={t('nav.theme.switch', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme')}
          title={t('nav.theme.switch', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme')}
          onClick={toggleTheme}
        >
          {themeIcon}
        </button>
        <button type="button" className="nav-start-cta" onClick={scrollToAgent}>
          {t('nav.startProject', 'Start a Project')} &rarr;
        </button>
      </div>

      {menuOpen.open && <button type="button" className="menu-backdrop" aria-label="Close navigation menu" onClick={closeMenu} />}
    </header>
  );
}

function LocaleSwitcher({
  locale,
  setLocale,
  availableLocales,
  currentLocale,
  localeOpen,
  setLocaleOpen,
  localeRef,
}: {
  locale: string;
  setLocale: (locale: string) => void;
  availableLocales: { code: string; name: string; nativeName: string }[];
  currentLocale: { code: string; name: string; nativeName: string } | null;
  localeOpen: boolean;
  setLocaleOpen: (open: boolean) => void;
  localeRef: React.MutableRefObject<HTMLDivElement | null>;
}) {
  const { t } = useI18n();
  return (
    <div className="locale-switcher" ref={localeRef}>
      <label id="locale-label">{t('nav.language', 'Language')}</label>
      <button
        type="button"
        className="locale-trigger"
        aria-haspopup="listbox"
        aria-expanded={localeOpen}
        aria-labelledby="locale-label"
        onClick={() => setLocaleOpen(!localeOpen)}
      >
        <span>{currentLocale?.nativeName ?? locale.toUpperCase()}</span>
        <span className="locale-chevron" aria-hidden="true">{'\u25BE'}</span>
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
