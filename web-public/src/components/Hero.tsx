import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';

export default function Hero() {
  const { t } = useI18n();

  return (
    <section className="hero" aria-labelledby="hero-headline">
      <div>
        <div className="eyebrow">
          {t('hero.eyebrow', 'Engineering studio')}
        </div>
        <h1 id="hero-headline">
          {t('hero.headline', 'We build the parts of your business that used to need')}{' '}
          <span className="hl">
            {t('hero.headlineHighlight', 'a bigger team')}
          </span>
          .
        </h1>
        <p className="lede">
          {t(
            'hero.subheadline',
            'A two-founder engineering studio pairing senior engineering with an AI agent workforce.'
          )}
        </p>
        <div className="cta-row">
          <Link to="/contact" className="cta primary">
            {t('hero.cta.primary', 'Start a project')}
          </Link>
          <Link to="/work" className="cta ghost">
            {t('hero.cta.secondary', 'See the work')}
          </Link>
        </div>
      </div>

      <div
        className="hero-art"
        role="img"
        aria-label="Abstract layered gradient composition"
      >
        <svg viewBox="0 0 400 400" aria-hidden="true">
          <circle
            cx="130"
            cy="140"
            r="90"
            fill="none"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="1.5"
          />
          <circle
            cx="270"
            cy="260"
            r="120"
            fill="none"
            stroke="rgba(255,255,255,0.14)"
            strokeWidth="1.5"
          />
          <path
            d="M40,320 C120,260 180,340 260,270 S 360,180 380,120"
            fill="none"
            stroke="rgba(233,214,174,0.55)"
            strokeWidth="2"
          />
        </svg>
      </div>
    </section>
  );
}
