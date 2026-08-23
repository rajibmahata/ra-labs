import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AgentChatPanel from '../components/AgentChatPanel';
import { api, type ProjectSummary, type TeamMember } from '../api/client';
import { useI18n } from '../i18n';
import { getInitials, avatarClassForIndex } from '../components/TeamCard';

interface SideItem {
  key: string;
  fallback: string;
  icon: string;
  route?: string;
}

interface SideGroup {
  groupKey: string;
  groupFallback: string;
  items: SideItem[];
}

const SIDEBAR_GROUPS: SideGroup[] = [
  {
    groupKey: 'agent.sidebar.group.main',
    groupFallback: 'MAIN',
    items: [
      { key: 'agent.sidebar.dashboard', fallback: 'Dashboard', icon: '\u2302', route: '/' },
      { key: 'agent.sidebar.conversations', fallback: 'Conversations', icon: '\u2371' },
      { key: 'agent.sidebar.projects', fallback: 'Projects', icon: '\u23A3', route: '/work' },
      { key: 'agent.sidebar.portfolio', fallback: 'Portfolio', icon: '\u25A3', route: '/portfolio' },
    ],
  },
];

/* ── Capabilities data ── */

interface CapItem { key: string; fallback: string; descKey: string; descFallback: string; icon: string; }
const CAPABILITIES: CapItem[] = [
  { key: 'agent.cap.ideation', fallback: 'Ideation & Planning', descKey: 'agent.cap.ideation.desc', descFallback: 'Validate ideas, requirements and product direction.', icon: '\u2667' },
  { key: 'agent.cap.design', fallback: 'Design & Development', descKey: 'agent.cap.design.desc', descFallback: 'UI/UX, coding and system architecture.', icon: '\u23A3' },
  { key: 'agent.cap.testing', fallback: 'Testing & QA', descKey: 'agent.cap.testing.desc', descFallback: 'Test cases, automation and quality checks.', icon: '\u2667' },
  { key: 'agent.cap.deployment', fallback: 'Deployment & DevOps', descKey: 'agent.cap.deployment.desc', descFallback: 'CI/CD, cloud, monitoring and scaling.', icon: '\u23A3' },
  { key: 'agent.cap.support', fallback: 'Support & Growth', descKey: 'agent.cap.support.desc', descFallback: 'Maintenance, analytics and feature growth.', icon: '\u23A3' },
];

/* ── Page ── */

export default function AgentChat() {
  const { t } = useI18n();
  const location = useLocation();

  const [portfolioProjects, setPortfolioProjects] = useState<ProjectSummary[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [featured, team] = await Promise.all([
          api.getFeaturedProjects({ pageSize: 3 }).then(async (featured) => {
            const featuredData = featured.data ?? [];
            if (featuredData.length > 0) return featuredData;
            const all = await api.getProjects({ pageSize: 3 });
            return all.data ?? [];
          }),
          api.getTeam().then((res) => res.data ?? []),
        ]);
        if (cancelled) return;
        setPortfolioProjects(featured);
        setTeamMembers(team);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="agent-layout">

      {/* ── Left Sidebar ── */}
      <aside className="agent-sidebar">
        <div className="agent-side-title">
          <span className="agent-side-dot" aria-hidden="true" />
          {t('agent.sidebar.title', 'AI Agent')}
        </div>

        {SIDEBAR_GROUPS.map((group) => (
          <div key={group.groupKey}>
            <div className="agent-side-group">
              {t(group.groupKey, group.groupFallback)}
            </div>
            <nav className="agent-side-nav" aria-label={t(group.groupKey, group.groupFallback)}>
              {group.items.map((item) => {
                const selected = item.route != null
                  ? location.pathname === item.route
                  : true; // items without a route are current-page (e.g. Conversations)
                if (!item.route) {
                  return (
                    <span
                      key={item.key}
                      className="agent-side-item selected"
                      aria-current="page"
                    >
                      <span className="agent-side-icon" aria-hidden="true">{item.icon}</span>
                      {t(item.key, item.fallback)}
                    </span>
                  );
                }
                return (
                  <Link
                    key={item.key}
                    to={item.route}
                    className={`agent-side-item${selected ? ' selected' : ''}`}
                  >
                    <span className="agent-side-icon" aria-hidden="true">{item.icon}</span>
                    {t(item.key, item.fallback)}
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}

        {/* Real team members — the people behind the agents */}
        {!loading && teamMembers.length > 0 && (
          <div>
            <div className="agent-side-group">
              {t('agent.sidebar.group.agents', 'AGENTS')}
            </div>
            <nav className="agent-side-nav" aria-label={t('agent.sidebar.group.agents', 'AGENTS')}>
              {teamMembers.map((member, i) => (
                <Link
                  key={member.id}
                  to={`/team/${encodeURIComponent(member.slug)}`}
                  className={`agent-side-item agent-side-agent${location.pathname === `/team/${member.slug}` ? ' selected' : ''}`}
                >
                  <span className={`agent-side-avatar-sm avatar ${avatarClassForIndex(i)}`} aria-hidden="true">
                    {member.avatarUrl ? (
                      <img src={member.avatarUrl} alt="" loading="lazy" />
                    ) : (
                      getInitials(member.name)
                    )}
                  </span>
                  <span className="agent-side-agent-meta">
                    <b>{member.name}</b>
                    <small>{member.role}</small>
                  </span>
                </Link>
              ))}
            </nav>
          </div>
        )}

        <div className="agent-side-profile">
          <div className="agent-side-avatar" aria-hidden="true">RA</div>
          <div>
            <b>{t('agent.sidebar.profile.studio', 'R&A Labs')}</b>
            <small>{t('agent.sidebar.profile.tagline', 'AI · Engineering Studio')}</small>
          </div>
        </div>
      </aside>

      {/* ── Center Content ── */}
      <main className="agent-main">
        <div className="agent-page-title">
          <h1>{t('agent.page.heading', 'RA Labs AI Agent')}</h1>
          <p>
            {t(
              'agent.page.subtitle',
              'Ask about our work, services and process — or let the agent collect your project brief.'
            )}
          </p>
        </div>

        <section className="agent-chat-shell">
          <AgentChatPanel mode="page" />
        </section>

        <div className="agent-trust-chips">
          <span className="agent-trust-chip">
            {'\u25C9 '}{t('agent.trust.secure', 'Secure & Private')}
          </span>
          <span className="agent-trust-chip">
            {'\u25EF '}{t('agent.trust.noTraining', 'No data training')}
          </span>
          <span className="agent-trust-chip">
            {'\u2726 '}{t('agent.trust.poweredBy', 'Powered by OpenCode Agents')}
          </span>
        </div>

        <section className="agent-capabilities">
          <h2>{t('agent.cap.heading', 'How can I help you today?')}</h2>
          <p>
            {t('agent.cap.intro', 'Our AI agents can assist you across your entire product development lifecycle.')}
          </p>
          <div className="agent-cap-cards">
            {CAPABILITIES.map((cap) => (
              <div key={cap.key} className="agent-cap-card">
                <div className="agent-cap-icon" aria-hidden="true">{cap.icon}</div>
                <b>{t(cap.key, cap.fallback)}</b>
                <p>{t(cap.descKey, cap.descFallback)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Portfolio Showcase ── */}
        {portfolioProjects.length > 0 && !loading && (
          <section className="agent-portfolio" aria-labelledby="agent-portfolio-heading">
            <div className="agent-portfolio-head">
              <h2 id="agent-portfolio-heading">{t('agent.portfolio.heading', 'Real products. Real outcomes.')}</h2>
              <Link to="/portfolio" className="agent-portfolio-view-all">
                {t('agent.portfolio.viewAll', 'View full portfolio')} &rarr;
              </Link>
            </div>
            <div className="agent-portfolio-grid">
              {portfolioProjects.map((project) => (
                <div key={project.id} className="project-card-enhanced">
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
              ))}
            </div>
          </section>
        )}

        {loading && (
          <div className="agent-portfolio-loading" aria-live="polite">
            <div className="spinner" />
            <p>{t('common.loading', 'Loading...')}</p>
          </div>
        )}

        {error && !loading && (
          <div className="agent-portfolio-error" role="alert">
            <p>{t('common.error', 'Could not load content')}</p>
          </div>
        )}
      </main>

      {/* ── Right Rail ── */}
      <aside className="agent-rail">

        {!loading && portfolioProjects.length > 0 && (
          <section className="agent-rail-panel">
            <div className="agent-rail-panel-head">
              <b>{t('agent.rail.work', 'Recent Work')}</b>
            </div>
            {portfolioProjects.slice(0, 4).map((project) => (
              <Link
                key={project.id}
                to={`/work/${encodeURIComponent(project.slug)}`}
                className="agent-rail-conversation"
              >
                {'\u23A3 '}
                {project.title}
                <small>{project.status === 'live' ? 'Live' : 'In build'}</small>
              </Link>
            ))}
            <Link to="/portfolio" className="agent-rail-view-all">
              {'\u25A3 \u00A0 '}{t('agent.rail.viewPortfolio', 'View portfolio')}
            </Link>
          </section>
        )}

        {!loading && teamMembers.length > 0 && (
          <section className="agent-rail-panel">
            <div className="agent-rail-panel-head">
              <b>{t('agent.rail.team', 'The Team')}</b>
            </div>
            {teamMembers.map((member, i) => (
              <Link
                key={member.id}
                to={`/team/${encodeURIComponent(member.slug)}`}
                className="agent-rail-agent-row"
              >
                <span className={`agent-side-avatar-sm avatar ${avatarClassForIndex(i + 1)}`} aria-hidden="true">
                  {member.avatarUrl ? (
                    <img src={member.avatarUrl} alt="" loading="lazy" />
                  ) : (
                    getInitials(member.name)
                  )}
                </span>
                <div>
                  <b>{member.name}</b>
                  <small>{member.role}</small>
                </div>
              </Link>
            ))}
            <Link to="/team" className="agent-rail-view-all">
              {'\u2726 \u00A0 '}{t('agent.rail.viewOurTeam', 'View our team')}
            </Link>
          </section>
        )}

        <section className="agent-rail-panel">
          <div className="agent-rail-panel-head">
            <b>{t('agent.rail.knowledge', 'What the agent knows')}</b>
          </div>
          <div className="agent-rail-knowledge">{'\u23A4 \u00A0 '}{t('agent.rail.kb1', 'Our portfolio and case studies')}</div>
          <div className="agent-rail-knowledge">{'\u23A4 \u00A0 '}{t('agent.rail.kb2', 'Services and delivery process')}</div>
          <div className="agent-rail-knowledge">{'\u23A4 \u00A0 '}{t('agent.rail.kb3', 'Team profiles and expertise')}</div>
        </section>

      </aside>
    </div>
  );
}
