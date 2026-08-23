import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, type TeamMember, type GithubRepositorySummary } from '../api/client';
import { useI18n } from '../i18n';
import { getInitials, formatRelativeTime, avatarClassForIndex } from '../components/TeamCard';

function formatMarkdownBio(md: string): string {
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Paragraphs
  const lines = html.split('\n');
  return lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      return `<p>${trimmed}</p>`;
    })
    .join('\n');
}

export default function TeamDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useI18n();

  const [member, setMember] = useState<TeamMember | null>(null);
  const [repositories, setRepositories] = useState<GithubRepositorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .getTeamMember(slug)
      .then(async (res) => {
        if (cancelled) return;
        const loaded = res.data;
        setMember(loaded);
        // Synchronized repositories authored by this member.
        if (loaded.githubUsername) {
          try {
            const repos = await api.getGithubRepositories({ pageSize: 50 });
            if (!cancelled) {
              setRepositories(
                (repos.data ?? []).filter(
                  (r) => r.owner.toLowerCase() === loaded.githubUsername?.toLowerCase()
                )
              );
            }
          } catch {
            if (!cancelled) setRepositories([]);
          }
        } else if (!cancelled) {
          setRepositories([]);
        }
        if (!cancelled) setLoading(false);
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
  }, [slug]);

  const snapshot = member?.githubSnapshot;
  const firstName = member?.name.split(' ')[0] ?? '';

  return (
    <section aria-labelledby="member-name">
      <div className="wrap">
        <Link to="/team" className="back-link">
          &larr; {t('nav.team', 'Team')}
        </Link>

        {/* State: loading */}
        {loading && (
          <div className="state-placeholder" aria-live="polite">
            <div className="spinner" />
            <p>{t('team.detail.loading', 'Loading profile...')}</p>
          </div>
        )}

        {/* State: error */}
        {error && !loading && (
          <div className="state-placeholder" role="alert">
            <h3>{t('team.detail.error', 'Team member not found')}</h3>
            <p>{error}</p>
            <Link to="/team" className="cta ghost" style={{ marginTop: 16 }}>
              {t('team.detail.back', 'Back to team')}
            </Link>
          </div>
        )}

        {/* State: populated */}
        {!loading && !error && member && (
          <article className="member-profile">
            {/* ── Profile header ── */}
            <header className="member-header">
              <div
                className={`member-avatar avatar ${avatarClassForIndex(0)}`}
                aria-hidden="true"
              >
                {member.avatarUrl ? (
                  <img src={member.avatarUrl} alt="" />
                ) : (
                  getInitials(member.name)
                )}
              </div>

              <div className="member-idblock">
                <h1 id="member-name">{member.name}</h1>
                <div className="member-role">{member.role}</div>

                <div className="member-meta">
                  {member.location && (
                    <span className="member-meta-item">
                      {'\u25CE '} {member.location}
                    </span>
                  )}
                  {member.githubUsername && (
                    <a
                      href={`https://github.com/${member.githubUsername}`}
                      className="member-meta-item member-link"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                      </svg>
                      @{member.githubUsername}
                    </a>
                  )}
                  {member.linkedinUrl && (
                    <a
                      href={member.linkedinUrl}
                      className="member-meta-item member-link"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {'in '}
                      {t('team.detail.linkedin', 'LinkedIn')}
                    </a>
                  )}
                </div>
              </div>
            </header>

            {/* ── GitHub metrics ── */}
            {snapshot && (
              <div className="work-detail-facts member-metrics">
                <div>
                  <dt>{t('team.detail.commits', 'Commits · 90 days')}</dt>
                  <dd>{snapshot.commits90d.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>{t('team.detail.repos', 'Active repositories')}</dt>
                  <dd>{snapshot.activeRepos}</dd>
                </div>
                <div>
                  <dt>{t('team.detail.lastCommit', 'Last commit')}</dt>
                  <dd>{formatRelativeTime(snapshot.lastCommitAt)}</dd>
                </div>
                <div>
                  <dt>{t('team.detail.synced', 'Snapshot synced')}</dt>
                  <dd>{formatRelativeTime(snapshot.capturedAt)}</dd>
                </div>
              </div>
            )}

            {/* ── About ── */}
            {member.bio ? (
              <section className="work-detail-section member-about" aria-labelledby="member-about-heading">
                <h2 id="member-about-heading">{t('team.detail.about', 'About')}</h2>
                <div
                  className="markdown-body"
                  dangerouslySetInnerHTML={{ __html: formatMarkdownBio(member.bio) }}
                />
              </section>
            ) : (
              <section className="work-detail-section">
                <p className="member-noabout">{t('team.detail.noBio', 'No bio available yet.')}</p>
              </section>
            )}

            {/* ── Synchronized repositories ── */}
            {repositories.length > 0 && (
              <section className="work-detail-section" aria-labelledby="member-repos-heading">
                <h2 id="member-repos-heading">
                  {t('team.detail.reposHeading', 'Synchronized repositories')}
                </h2>
                <div className="member-repo-grid">
                  {repositories.map((repo) => (
                    <a
                      key={repo.id}
                      href={repo.htmlUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="member-repo-card"
                    >
                      <b>{repo.name}</b>
                      {repo.description && <p>{repo.description}</p>}
                      <div className="member-repo-meta">
                        {repo.primaryLanguage && <span className="tag">{repo.primaryLanguage}</span>}
                        {repo.pushedAt && (
                          <small>pushed {formatRelativeTime(repo.pushedAt)}</small>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* ── CTA ── */}
            <section className="member-cta-band">
              <div>
                <b>
                  {t('team.detail.cta.title', `Want ${firstName} on your project?`)}
                </b>
                <p>
                  {t(
                    'team.detail.cta.body',
                    'Tell the AI agent about your goal — you will have a structured brief for the team in minutes.'
                  )}
                </p>
              </div>
              <Link to="/agent" className="cta primary">
                {t('team.detail.cta.action', 'Start a project')} &rarr;
              </Link>
            </section>
          </article>
        )}
      </div>
    </section>
  );
}
