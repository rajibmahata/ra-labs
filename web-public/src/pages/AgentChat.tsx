import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AgentChatPanel from '../components/AgentChatPanel';
import { api, type ProjectSummary } from '../api/client';
import { useI18n } from '../i18n';

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
      { key: 'agent.sidebar.knowledge', fallback: 'Knowledge Base', icon: '\u23A4' },
    ],
  },
  {
    groupKey: 'agent.sidebar.group.agents',
    groupFallback: 'AGENTS',
    items: [
      { key: 'agent.sidebar.opencode', fallback: 'OpenCode Agents', icon: '\u2726', route: '/team' },
      { key: 'agent.sidebar.frontend', fallback: 'Frontend Engineer', icon: '+', route: '/team' },
      { key: 'agent.sidebar.backend', fallback: 'Backend Engineer', icon: '+', route: '/team' },
      { key: 'agent.sidebar.devops', fallback: 'DevOps Engineer', icon: '+', route: '/team' },
      { key: 'agent.sidebar.designer', fallback: 'UI/UX Designer', icon: '+', route: '/team' },
      { key: 'agent.sidebar.qa', fallback: 'QA Engineer', icon: '+', route: '/team' },
      { key: 'agent.sidebar.database', fallback: 'Database Expert', icon: '+', route: '/team' },
      { key: 'agent.sidebar.ml', fallback: 'AI/ML Engineer', icon: '+', route: '/team' },
      { key: 'agent.sidebar.pm', fallback: 'Product Manager', icon: '+', route: '/team' },
    ],
  },
];

/* ── Static rail data ── */

interface ConvItem { key: string; fallback: string; time: string; active?: boolean; }
interface AgentRow { key: string; fallback: string; version: string; icon: string; }
interface KnowledgeItem { key: string; fallback: string; updated: string; }

const RAIL_CONVERSATIONS: ConvItem[] = [
  { key: 'agent.rail.conv1', fallback: 'Booking application for clinic', time: '11:20 AM', active: true },
  { key: 'agent.rail.conv2', fallback: 'E-commerce platform discussion', time: 'Yesterday' },
  { key: 'agent.rail.conv3', fallback: 'AI chatbot for website', time: '2 days ago' },
  { key: 'agent.rail.conv4', fallback: 'Project collaboration workflow', time: '3 days ago' },
];

const RAIL_AGENTS: AgentRow[] = [
  { key: 'agent.rail.agent1', fallback: 'Frontend Engineer', version: 'OpenCode \u00B7 v1.2.1', icon: '\u25C9' },
  { key: 'agent.rail.agent2', fallback: 'Backend Engineer', version: 'OpenCode \u00B7 v1.2.1', icon: '\u25C9' },
  { key: 'agent.rail.agent3', fallback: 'DevOps Engineer', version: 'OpenCode \u00B7 v1.2.1', icon: '\u25C9' },
  { key: 'agent.rail.agent4', fallback: 'UI/UX Designer', version: 'OpenCode \u00B7 v1.2.1', icon: '\u2726' },
  { key: 'agent.rail.agent5', fallback: 'QA Engineer', version: 'OpenCode \u00B7 v1.2.1', icon: '\u2667' },
];

const RAIL_KNOWLEDGE: KnowledgeItem[] = [
  { key: 'agent.rail.kb1', fallback: 'Project Requirements Guide', updated: 'Updated 2 days ago' },
  { key: 'agent.rail.kb2', fallback: 'Our Process & Methodology', updated: 'Updated 5 days ago' },
  { key: 'agent.rail.kb3', fallback: 'Tech Stack Overview', updated: 'Updated 1 week ago' },
];

/* ── Capabilities data ── */

interface CapItem { key: string; fallback: string; descKey: string; descFallback: string; icon: string; }
const CAPABILITIES: CapItem[] = [
  { key: 'agent.cap.ideation', fallback: 'Ideation & Planning', descKey: 'agent.cap.ideation.desc', descFallback: 'Validate ideas, requirements and product direction.', icon: '\u2667' },
  { key: 'agent.cap.design', fallback: 'Design & Development', descKey: 'agent.cap.design.desc', descFallback: 'UI/UX, coding and system architecture.', icon: '\u23A3' },
  { key: 'agent.cap.testing', fallback: 'Testing & QA', descKey: 'agent.cap.testing.desc', descFallback: 'Test cases, automation and quality checks.', icon: '\u2667' },
  { key: 'agent.cap.deployment', fallback: 'Deployment & DevOps', descKey: 'agent.cap.deployment.desc', descFallback: 'CI/CD, cloud, monitoring and scaling.', icon: '\u2667' },
  { key: 'agent.cap.support', fallback: 'Support & Growth', descKey: 'agent.cap.support.desc', descFallback: 'Maintenance, analytics and feature growth.', icon: '\u23A3' },
];

/* ── Page ── */

export default function AgentChat() {
  const { t } = useI18n();
  const location = useLocation();

  const [portfolioProjects, setPortfolioProjects] = useState<ProjectSummary[]>([]);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPortfolioLoading(true);
    setPortfolioError(null);
    (async () => {
      try {
        const featured = await api.getFeaturedProjects({ pageSize: 3 });
        if (cancelled) return;
        const featuredData = featured.data ?? [];
        if (featuredData.length > 0) {
          setPortfolioProjects(featuredData);
        } else {
          const all = await api.getProjects({ pageSize: 3 });
          if (cancelled) return;
          setPortfolioProjects(all.data ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setPortfolioError(err instanceof Error ? err.message : 'Failed to load projects');
        }
      } finally {
        if (!cancelled) setPortfolioLoading(false);
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
                  : true; // items without a route are current-page (e.g. Conversations, Knowledge Base)
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

        <div className="agent-side-profile">
          <div className="agent-side-avatar" aria-hidden="true">RM</div>
          <div>
            <b>{t('agent.sidebar.profile.name', 'Rajib Mahata')}</b>
            <small>{t('agent.sidebar.profile.role', 'Administrator')}</small>
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
        {portfolioProjects.length > 0 && !portfolioLoading && (
          <section className="agent-portfolio" aria-labelledby="agent-portfolio-heading">
            <div className="agent-portfolio-head">
              <h2 id="agent-portfolio-heading">{t('agent.portfolio.heading', 'Real products. Real outcomes.')}</h2>
              <Link to="/work" className="agent-portfolio-view-all">
                {t('agent.portfolio.viewAll', 'View all work')} &rarr;
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

        {portfolioLoading && (
          <div className="agent-portfolio-loading" aria-live="polite">
            <div className="spinner" />
            <p>{t('common.loading', 'Loading projects...')}</p>
          </div>
        )}

        {portfolioError && !portfolioLoading && (
          <div className="agent-portfolio-error" role="alert">
            <p>{t('common.error', 'Could not load projects')}</p>
          </div>
        )}

        {!portfolioLoading && !portfolioError && portfolioProjects.length === 0 && (
          <div className="agent-portfolio-empty">
            <p>{t('common.empty', 'No projects yet')}</p>
          </div>
        )}
      </main>

      {/* ── Right Rail ── */}
      <aside className="agent-rail">

        <section className="agent-rail-panel">
          <div className="agent-rail-panel-head">
            <b>{t('agent.rail.conversations', 'Your Conversations')}</b>
          </div>
          {RAIL_CONVERSATIONS.map((item) => (
            <div
              key={item.key}
              className={`agent-rail-conversation${item.active ? ' active' : ''}`}
            >
              {item.active ? '\uD83D\uDFE2 ' : '\u2371 '}
              {t(item.key, item.fallback)}
              <small>{item.time}</small>
            </div>
          ))}
        </section>

        <section className="agent-rail-panel">
          <div className="agent-rail-panel-head">
            <b>{t('agent.rail.agents', 'OpenCode Agents')}</b>
          </div>
          {RAIL_AGENTS.map((item) => (
            <div key={item.key} className="agent-rail-agent-row">
              <div className="agent-rail-agent-icon" aria-hidden="true">{item.icon}</div>
              <div>
                <b>{t(item.key, item.fallback)}</b>
                <small>{item.version}</small>
              </div>
              <span className="agent-rail-agent-online">
                {'\u25CF '}{t('agent.rail.online', 'Online')}
              </span>
            </div>
          ))}
          <Link to="/team" className="agent-rail-view-all">
            {'\u2726 \u00A0 '}{t('agent.rail.viewOurTeam', 'View our team')}
          </Link>
        </section>

        <section className="agent-rail-panel">
          <div className="agent-rail-panel-head">
            <b>{t('agent.rail.knowledge', 'Knowledge Base')}</b>
          </div>
          {RAIL_KNOWLEDGE.map((item) => (
            <div key={item.key} className="agent-rail-knowledge">
              {'\u23A4 \u00A0 '}{t(item.key, item.fallback)}
              <small>{item.updated}</small>
            </div>
          ))}
        </section>

      </aside>
    </div>
  );
}
