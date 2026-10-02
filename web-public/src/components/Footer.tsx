import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';

export default function Footer() {
  const { t } = useI18n();
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer" role="contentinfo" id="contact-footer">
      <div>
        <strong>R&amp;A Labs</strong> &middot; {t('footer.tagline', 'AI Engineering Studio')}
      </div>
      <nav className="footer-nav" aria-label={t('footer.navLabel', 'Footer navigation')}>
        <Link to="/work">{t('nav.work', 'Work')}</Link>
        <Link to="/team">{t('nav.team', 'Team')}</Link>
        <Link to="/contact">{t('nav.contact', 'Contact')}</Link>
        <a href="mailto:hello@ralabs.dev">{t('footer.email', 'hello@ralabs.dev')}</a>
      </nav>
      <div>
        {t('footer.copyright', `\u00A9 ${year} RA Labs. Build something meaningful.`)}
      </div>
    </footer>
  );
}
