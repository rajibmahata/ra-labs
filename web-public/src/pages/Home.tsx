import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type ProjectSummary, type TeamMember } from '../api/client';
import { useI18n } from '../i18n';
import TeamCard from '../components/TeamCard';
import ContactForm from '../components/ContactForm';
import AgentChatPanel from '../components/AgentChatPanel';

const AGENT_CAPABILITIES = [
  { icon: '\uD83D\uDCAC', key: 'home.cap.answers', fallbackTitle: 'Answers about our work', fallbackBody: 'Portfolio, services, process, team \u2014 grounded in our indexed content and knowledge base.' },
  { icon: '\uD83D\uDCC4', key: 'home.cap.brief', fallbackTitle: 'Collects your project brief', fallbackBody: 'A guided step-by-step intake to capture requirements, goals, features, and constraints.' },
  { icon: '\uD83E\uDDE0', key: 'home.cap.grounded', fallbackTitle: 'Grounded, not invented', fallbackBody: 'Retrieval-augmented answers. No made-up facts. Just verified information.' },
  { icon: '\uD83D\uDEE1', key: 'home.cap.private', fallbackTitle: 'Private by default', fallbackBody: 'Session-scoped threads. No tracking, no ads, no unnecessary data sharing.' },
];

const WORK_CARDS = [
  { key: 'home.work.customer', fallbackTitle: 'Live Customer Applications', fallbackBody: 'Show verified customer projects, live URLs, case studies, technology and outcomes.' },
  { key: 'home.work.ai', fallbackTitle: 'AI & SaaS Platforms', fallbackBody: 'Showcase the products and engineering systems built by the RA Labs team.' },
  { key: 'home.work.oss', fallbackTitle: 'Open Source', fallbackBody: 'Connect verified GitHub repositories and automatically keep project information current.' },
  { key: 'home.work.explore', fallbackTitle: 'Explore Our Work \u2192', fallbackBody: 'Browse the complete portfolio and visit live projects.' },
];

const METRICS = [
  { icon: '\uD83D\uDC65', value: '50+', labelKey: 'home.metrics.projects', fallbackLabel: 'Projects Delivered' },
  { icon: '\u2039/\u203A', value: '12+', labelKey: 'home.metrics.years', fallbackLabel: 'Years Experience' },
  { icon: '\u25A6', value: '5+', labelKey: 'home.metrics.industries', fallbackLabel: 'Industries Served' },
  { icon: '\u25CE', value: 'Global', labelKey: 'home.metrics.clientele', fallbackLabel: 'Clientele' },
  { icon: '\u25F7', value: '100%', labelKey: 'home.metrics.commitment', fallbackLabel: 'Commitment' },
];

const HERO_BENEFITS = [
  { icon: '\u2699', key: 'home.benefit.ai', fallbackLabel: 'AI-Powered', fallbackSublabel: 'Development' },
  { icon: '\u2B21', key: 'home.benefit.secure', fallbackLabel: 'Secure &', fallbackSublabel: 'Scalable' },
  { icon: '\u25F7', key: 'home.benefit.delivery', fallbackLabel: 'On-Time', fallbackSublabel: 'Delivery' },
  { icon: '\u2662', key: 'home.benefit.partnership', fallbackLabel: 'Long-term', fallbackSublabel: 'Partnership' },
];

const JOURNEY_STEPS = [
  { number: '01', titleKey: 'journey.idea.title', bodyKey: 'journey.idea.body', fallbackTitle: 'Share Your Idea', fallbackBody: 'Tell us what you want to build in plain language.' },
  { number: '02', titleKey: 'journey.talk.title', bodyKey: 'journey.talk.body', fallbackTitle: 'Talk With Our AI', fallbackBody: 'Our agent asks clarifying questions to understand your vision.' },
  { number: '03', titleKey: 'journey.request.title', bodyKey: 'journey.request.body', fallbackTitle: 'Create Your Project Request', fallbackBody: 'The agent turns your answers into a structured project brief.' },
  { number: '04', titleKey: 'journey.define.title', bodyKey: 'journey.define.body', fallbackTitle: 'Define Requirements', fallbackBody: 'Goal, users, features, timeline, budget \u2014 all captured.' },
  { number: '05', titleKey: 'journey.review.title', bodyKey: 'journey.review.body', fallbackTitle: 'Human Expert Review', fallbackBody: 'A senior engineer reviews your brief and prepares a proposal.' },
  { number: '06', titleKey: 'journey.prd.title', bodyKey: 'journey.prd.body', fallbackTitle: 'PRD and Approval', fallbackBody: 'We deliver a product requirements document for your sign-off.' },
  { number: '07', titleKey: 'journey.build.title', bodyKey: 'journey.build.body', fallbackTitle: 'Build and Iterate', fallbackBody: 'Our team builds your product with regular progress updates.' },
  { number: '08', titleKey: 'journey.demo.title', bodyKey: 'journey.demo.body', fallbackTitle: 'Demo and Feedback', fallbackBody: 'Review working builds, share feedback, and refine.' },
  { number: '09', titleKey: 'journey.launch.title', bodyKey: 'journey.launch.body', fallbackTitle: 'Launch', fallbackBody: 'Your product ships \u2014 tested, polished, and ready for users.' },
];

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

export default function Home() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [featured, setFeatured] = useState<ProjectSummary[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [teamLoading, setTeamLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [teamError, setTeamError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setProjectsLoading(true);
    setProjectsError(null);
    api
      .getProjects({ pageSize: 20 })
      .then((res) => {
        if (!cancelled) {
          setProjects(res.data ?? []);
          setProjectsLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setProjectsError(err.message);
          setProjectsLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .getFeaturedProjects({ pageSize: 6 })
      .then((res) => {
        if (!cancelled) setFeatured(res.data ?? []);
      })
      .catch(() => { /* silent fallback */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setTeamLoading(true);
    setTeamError(null);
    api
      .getTeam()
      .then((res) => {
        if (!cancelled) {
          setTeam(res.data ?? []);
          setTeamLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setTeamError(err.message);
          setTeamLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  const scrollToAgent = useCallback(() => {
    const el = document.querySelector('.hero-agent-wrapper');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate('/agent');
    }
  }, [navigate]);

  const displayProjects = featured.length > 0 ? featured : projects;

  return (
    <>
      {/* ================================================================ */}
      {/* HERO — Two-column with isometric cubes + agent panel             */}
      {/* ================================================================ */}
      <section className="hero-premium" aria-labelledby="hero-headline">
        <div className="wrap">
          <div className="hero-copy hero-copy-entrance">
            <div className="badge">
              <span className="dot" aria-hidden="true" />
              {t('hero.eyebrow', 'AI AGENT \u00B7 ENGINEERING STUDIO')}
            </div>
            <h1 id="hero-headline">
              {t('hero.headlineBefore', 'We build backend systems and SaaS products that')}{' '}
              <span className="hl">{t('hero.headlineHighlight', 'scale, perform,')}</span>{' '}
              {t('hero.headlineAfter', 'and ship.')}
            </h1>
            <p className="hero-lede">
              {t(
                'hero.subheadline',
                'A two-founder engineering studio with 12+ years of production experience across Fortune 500 healthcare, enterprise telecom, and AI-powered products.'
              )}
            </p>
            <div className="hero-actions">
              <button type="button" className="cta primary" onClick={scrollToAgent}>
                {t('hero.cta.primary', 'Start a project')} &rarr;
              </button>
              <Link to="/work" className="outline">
                {t('hero.cta.secondary', 'See our work')}
              </Link>
            </div>
            <div className="hero-benefits" aria-label={t('hero.benefits.label', 'Studio highlights')}>
              {HERO_BENEFITS.map((b) => (
                <div className="hero-benefit" key={b.key}>
                  <div className="benefit-ico" aria-hidden="true">{b.icon}</div>
                  <div>
                    {t(b.key, b.fallbackLabel)}
                    <span>{t(b.key + '.sub', b.fallbackSublabel)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="hero-visual">
            <div className="gridfloor" aria-hidden="true" />
            <div className="hero-cubes" aria-hidden="true">
              <div className="hero-cube cube-c1" />
              <div className="hero-cube glow cube-c2" />
              <div className="hero-cube cube-c3" />
              <div className="hero-cube glow cube-c4" />
              <div className="hero-cube cube-c5" />
              <div className="hero-cube glow cube-c6" />
            </div>
            <div className="hero-agent-wrapper" aria-label={t('agent.panel.label', 'R&A Labs AI agent')}>
              <AgentChatPanel mode="home" />
              <div className="hero-privacy-note">{t('home.privacy', '\u2667 Your conversation stays private and secure.')}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* WHAT THE AGENT CAN DO + METRICS                                  */}
      {/* ================================================================ */}
      <div className="wrap">
        <section className="section" id="services" aria-labelledby="services-heading">
          <div className="kicker">{t('home.agentKicker', '\u2726 THE AI ASSISTANT')}</div>
          <h2 id="services-heading">{t('home.agentTitle', 'What the agent can do')}</h2>
          <div className="cards">
            {AGENT_CAPABILITIES.map((cap) => (
              <div className="card" key={cap.key}>
                <div className="ci" aria-hidden="true">{cap.icon}</div>
                <h3>{t(cap.key, cap.fallbackTitle)}</h3>
                <p>{t(cap.key + '.body', cap.fallbackBody)}</p>
              </div>
            ))}
          </div>
          <div className="metrics" aria-label={t('home.metrics.label', 'Studio metrics')}>
            {METRICS.map((m) => (
              <div className="metric" key={m.labelKey}>
                <div className="mi" aria-hidden="true">{m.icon}</div>
                <div>
                  <b>{m.value}</b>
                  <span>{t(m.labelKey, m.fallbackLabel)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ================================================================ */}
      {/* SELECTED WORK                                                    */}
      {/* ================================================================ */}
      <div className="wrap">
        <section className="section" id="work" aria-labelledby="work-section-heading">
          <div className="kicker">{t('home.workKicker', 'SELECTED WORK')}</div>
          <h2 id="work-section-heading">{t('home.workTitle', 'Real products. Real outcomes.')}</h2>
          <div className="cards">
            {WORK_CARDS.map((card, i) => (
              <div className="card" key={card.key}>
                <h3>{t(card.key, card.fallbackTitle)}</h3>
                <p>{t(card.key + '.body', card.fallbackBody)}</p>
                {i === 3 && (
                  <p style={{ marginTop: '10px' }}>
                    <Link to="/work" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                      {t('home.work.viewAll', 'View all work')} &rarr;
                    </Link>
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ================================================================ */}
      {/* LIVE WORK / PORTFOLIO (real API data)                            */}
      {/* ================================================================ */}
      {displayProjects.length > 0 && (
        <section aria-labelledby="portfolio-heading">
          <RevealSection>
            <div className="wrap">
              <div className="section-head">
                <div>
                  <div className="eyebrow">{t('portfolio.eyebrow', 'Selected Work')}</div>
                  <h2 id="portfolio-heading">{t('portfolio.title', 'Live Work and Case Studies')}</h2>
                </div>
                <Link to="/work" className="cta ghost">
                  {t('portfolio.viewAll', 'View all work')} &rarr;
                </Link>
              </div>
              <div className="portfolio-grid-enhanced">
                {displayProjects.map((project) => (
                  <EnhancedProjectCard key={project.id} project={project} />
                ))}
              </div>
            </div>
          </RevealSection>
        </section>
      )}

      {projectsLoading && (
        <section>
          <div className="wrap">
            <div className="state-placeholder" aria-live="polite">
              <div className="spinner" />
              <p>{t('common.loading', 'Loading projects...')}</p>
            </div>
          </div>
        </section>
      )}

      {projectsError && !projectsLoading && (
        <section>
          <div className="wrap">
            <div className="state-placeholder" role="alert">
              <h3>{t('common.error', 'Could not load projects')}</h3>
              <p>{projectsError}</p>
            </div>
          </div>
        </section>
      )}

      {!projectsLoading && !projectsError && displayProjects.length === 0 && (
        <section>
          <div className="wrap">
            <div className="state-placeholder">
              <h3>{t('common.empty', 'No projects yet')}</h3>
              <p>{t('common.emptyHint', 'Check back soon for our latest work.')}</p>
            </div>
          </div>
        </section>
      )}

      {/* ================================================================ */}
      {/* CUSTOMER JOURNEY                                                 */}
      {/* ================================================================ */}
      <section id="journey" aria-labelledby="journey-heading">
        <RevealSection>
          <div className="wrap">
            <div className="section-head">
              <div>
                <div className="eyebrow">{t('journey.eyebrow', 'How We Work')}</div>
                <h2 id="journey-heading">{t('journey.title', 'From Idea to Launch')}</h2>
              </div>
            </div>
            <div className="journey-stepper" role="list">
              {JOURNEY_STEPS.map((step) => (
                <div className="journey-step-v2" key={step.number} role="listitem">
                  <div className="js-number" aria-hidden="true">{step.number}</div>
                  <div>
                    <h3>{t(step.titleKey, step.fallbackTitle)}</h3>
                    <p>{t(step.bodyKey, step.fallbackBody)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </RevealSection>
      </section>

      {/* ================================================================ */}
      {/* TEAM                                                             */}
      {/* ================================================================ */}
      <section id="team" aria-labelledby="team-heading">
        <RevealSection>
          <div className="wrap">
            <div className="section-head">
              <div>
                <div className="eyebrow">{t('team.eyebrow', 'Team')}</div>
                <h2 id="team-heading">{t('team.title', 'The People Behind the Studio')}</h2>
              </div>
              <Link to="/team" className="cta ghost">
                {t('team.viewAll', 'Meet the team')} &rarr;
              </Link>
            </div>

            {teamLoading && (
              <div className="state-placeholder" aria-live="polite">
                <div className="spinner" />
                <p>{t('common.loading', 'Loading team...')}</p>
              </div>
            )}

            {teamError && !teamLoading && (
              <div className="state-placeholder" role="alert">
                <h3>{t('common.error', 'Could not load team')}</h3>
                <p>{teamError}</p>
              </div>
            )}

            {!teamLoading && !teamError && team.length === 0 && (
              <div className="state-placeholder">
                <h3>{t('common.empty', 'No team members listed')}</h3>
                <p>{t('common.emptyHint', 'Team profiles are coming soon.')}</p>
              </div>
            )}

            {!teamLoading && !teamError && team.length > 0 && (
              <div className="team-grid">
                {team.map((member, i) => (
                  <TeamCard key={member.id} member={member} index={i} />
                ))}
              </div>
            )}
          </div>
        </RevealSection>
      </section>

      {/* ================================================================ */}
      {/* CONTACT                                                          */}
      {/* ================================================================ */}
      <section id="contact" className="alt" aria-labelledby="contact-heading">
        <RevealSection>
          <div className="wrap">
            <div className="contact-layout">
              <div className="contact-info">
                <div className="eyebrow">{t('contact.eyebrow', 'Get in Touch')}</div>
                <h2 id="contact-heading">{t('contact.title', 'Tell us the problem. We will sketch the first version.')}</h2>
                <p>{t('contact.subtitle', 'Usually a reply within one business day.')}</p>
              </div>
              <ContactForm inline />
            </div>
          </div>
        </RevealSection>
      </section>

      {/* ================================================================ */}
      {/* FINAL CTA                                                        */}
      {/* ================================================================ */}
      <section>
        <RevealSection>
          <div className="wrap">
            <div className="final-cta-section">
              <h2>{t('contact.cta.final', 'Ready to start building?')}</h2>
              <p>{t('contact.cta.finalSubtext', 'Talk to our AI agent, describe your idea, and get a project brief started \u2014 all in one conversation.')}</p>
              <Link to="/agent" className="cta primary">
                {t('contact.cta.button', 'Start a Conversation')}
              </Link>
            </div>
          </div>
        </RevealSection>
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Reveal wrapper (IntersectionObserver scroll animation)              */
/* ------------------------------------------------------------------ */
function RevealSection({ children }: { children: React.ReactNode }) {
  const { ref, visible } = useReveal();
  return (
    <div ref={ref} className={`reveal${visible ? ' in' : ''}`}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Enhanced project card                                               */
/* ------------------------------------------------------------------ */
function EnhancedProjectCard({ project }: { project: ProjectSummary }) {
  const { t } = useI18n();

  return (
    <div className="project-card-enhanced">
      <div className="pce-cover">
        {project.coverImageUrl ? (
          <img src={project.coverImageUrl} alt="" loading="lazy" />
        ) : (
          <div className="cover-gradient g1" aria-hidden="true" />
        )}
      </div>
      <div className="pce-body">
        <h3>{project.title}</h3>
        <p className="pce-summary">{project.summary}</p>

        {project.stackTags.length > 0 && (
          <div className="tags">
            {project.stackTags.map((tag) => (
              <span className="tag" key={tag}>{tag}</span>
            ))}
          </div>
        )}

        <div className="pce-actions">
          <Link to={`/work/${encodeURIComponent(project.slug)}`} className="pce-action">
            {t('portfolio.caseStudy', 'View Case Study')} &rarr;
          </Link>
          {project.liveSiteUrl && (
            <a href={project.liveSiteUrl} target="_blank" rel="noopener noreferrer" className="pce-action">
              {t('portfolio.liveSite', 'Visit Live Site')} &nearr;
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
