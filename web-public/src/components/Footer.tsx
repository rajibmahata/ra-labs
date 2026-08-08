import { useI18n } from '../i18n';

export default function Footer() {
  const { t } = useI18n();
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer" role="contentinfo">
      <span>&copy; {year} R&amp;A Labs</span>
      <span className="footer-tagline mono">
        {t('footer.tagline', 'built by the studio it describes')}
      </span>
    </footer>
  );
}
