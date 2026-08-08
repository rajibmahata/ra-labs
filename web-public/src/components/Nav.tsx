import { Link, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n';

export default function Nav() {
  const { locale, setLocale, availableLocales, t } = useI18n();
  const location = useLocation();

  const isActive = (path: string): string => {
    if (path === '/') return location.pathname === '/' ? 'active' : '';
    return location.pathname.startsWith(path) ? 'active' : '';
  };

  return (
    <header className="site-header" role="banner">
      <Link to="/" className="wordmark" aria-label="R&A Labs home">
        R&amp;A <em>Labs</em>
      </Link>

      <nav aria-label="Main navigation">
        <Link to="/work" className={isActive('/work')}>
          {t('nav.work', 'Work')}
        </Link>
        <Link to="/team" className={isActive('/team')}>
          {t('nav.team', 'Team')}
        </Link>
        <Link to="/contact" className={isActive('/contact')}>
          {t('nav.contact', 'Contact')}
        </Link>

        <div className="locale-switcher">
          <label htmlFor="locale-select" className="sr-only">
            Select language
          </label>
          <select
            id="locale-select"
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            aria-label="Language selector"
          >
            {availableLocales.map((l) => (
              <option key={l.code} value={l.code}>
                {l.nativeName}
              </option>
            ))}
          </select>
        </div>
      </nav>
    </header>
  );
}
