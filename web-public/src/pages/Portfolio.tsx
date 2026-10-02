import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, type ProjectSummary } from '../api/client';
import { useI18n } from '../i18n';

export default function Portfolio() {
  const { t } = useI18n();

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getProjects({ pageSize: 24 })
      .then((res) => {
        if (!cancelled) {
          setProjects(res.data ?? []);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section aria-labelledby="portfolio-heading">
      <div className="wrap">
        <div className="section-head">
          <div>
            <div className="eyebrow">{t('portfolio.eyebrow', 'Portfolio')}</div>
            <h1 id="portfolio-heading">
              {t('portfolio.title', 'Products we have shipped')}
            </h1>
            <p className="section-sub">
              {t(
                'portfolio.subtitle',
                'Every project below is real work — open a case study for the full story, or visit the live product.'
              )}
            </p>
          </div>
        </div>

        {/* State: loading */}
        {loading && (
          <div className="state-placeholder" aria-live="polite">
            <div className="spinner" />
            <p>{t('portfolio.loading', 'Loading projects...')}</p>
          </div>
        )}

        {/* State: error */}
        {error && !loading && (
          <div className="state-placeholder" role="alert">
            <h3>{t('portfolio.error', 'Could not load projects')}</h3>
            <p>{error}</p>
          </div>
        )}

        {/* State: empty */}
        {!loading && !error && projects.length === 0 && (
          <div className="state-placeholder">
            <h3>{t('portfolio.empty.heading', 'No published projects yet')}</h3>
            <p>{t('portfolio.empty.body', 'Delivered client work will appear here.')}</p>
          </div>
        )}

        {/* State: populated */}
        {!loading && !error && projects.length > 0 && (
          <div className="portfolio-list">
            {projects.map((project) => (
              <article key={project.id} className="portfolio-row">
                <Link
                  to={`/work/${encodeURIComponent(project.slug)}`}
                  className="portfolio-cover"
                  aria-label={project.title}
                >
                  {project.coverImageUrl ? (
                    <img src={project.coverImageUrl} alt="" loading="lazy" />
                  ) : (
                    <span className={`cover-gradient ${project.isFeatured ? 'g1' : 'g2'}`} aria-hidden="true" />
                  )}
                  <span className={`pf-status ${project.status === 'live' ? 'is-live' : ''}`}>
                    {project.status === 'live'
                      ? t('portfolio.status.live', 'Live')
                      : t('portfolio.status.inBuild', 'In build')}
                  </span>
                </Link>

                <div className="portfolio-body">
                  <div className="portfolio-titles">
                    <h2>
                      <Link to={`/work/${encodeURIComponent(project.slug)}`}>
                        {project.title}
                      </Link>
                    </h2>
                    {project.category && <span className="pf-category">{project.category}</span>}
                  </div>

                  <p className="portfolio-summary">{project.summary}</p>

                  {project.stackTags.length > 0 && (
                    <div className="tags">
                      {project.stackTags.map((tag) => (
                        <span className="tag" key={tag}>{tag}</span>
                      ))}
                    </div>
                  )}

                  <div className="portfolio-links">
                    <Link to={`/work/${encodeURIComponent(project.slug)}`} className="pf-link primary">
                      {t('portfolio.caseStudy', 'Case study')} &rarr;
                    </Link>
                    {project.liveSiteUrl && (
                      <a
                        href={project.liveSiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pf-link"
                      >
                        {t('portfolio.liveSite', 'Live site')} &nearr;
                      </a>
                    )}
                    {project.githubUrl && (
                      <a
                        href={project.githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pf-link"
                      >
                        GitHub &nearr;
                      </a>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
