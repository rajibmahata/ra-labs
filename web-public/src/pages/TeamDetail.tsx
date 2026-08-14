import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, type TeamMember } from '../api/client';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .getTeamMember(slug)
      .then((res) => {
        if (!cancelled) {
          setMember(res.data);
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
  }, [slug]);

  const snapshot = member?.githubSnapshot;

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
          <article>
            <div className="team-detail-layout">
              <div
                className={`avatar ${avatarClassForIndex(0)}`}
                style={{ width: 120, height: 120, fontSize: 32 }}
                aria-hidden="true"
              >
                {member.avatarUrl ? (
                  <img
                    src={member.avatarUrl}
                    alt=""
                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  getInitials(member.name)
                )}
              </div>

              <div>
                <h1 id="member-name" style={{ marginBottom: 4 }}>
                  {member.name}
                </h1>
                <div
                  style={{
                    fontSize: '14px',
                    color: 'var(--blue)',
                    fontWeight: 600,
                    marginBottom: 16,
                  }}
                >
                  {member.role}
                </div>

                {member.githubUsername && (
                  <a
                    href={`https://github.com/${member.githubUsername}`}
                    className="github-link"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ marginBottom: 20, display: 'inline-flex' }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                    @{member.githubUsername}
                  </a>
                )}

                {/* GitHub Snapshot */}
                {snapshot && (
                  <div className="team-stats" style={{ marginBottom: 24 }}>
                    <div className="team-stat">
                      <b>{snapshot.commits90d.toLocaleString()}</b>
                      <span>commits, 90d</span>
                    </div>
                    <div className="team-stat">
                      <b>{snapshot.activeRepos}</b>
                      <span>active repos</span>
                    </div>
                    <div className="team-stat">
                      <b>{formatRelativeTime(snapshot.lastCommitAt)}</b>
                      <span>last commit</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bio */}
            {member.bio && (
              <div
                style={{
                  marginTop: 32,
                  maxWidth: 680,
                  color: 'var(--ink-dim)',
                  lineHeight: 1.7,
                  fontSize: '15px',
                }}
              >
                <div
                  className="markdown-body"
                  dangerouslySetInnerHTML={{
                    __html: formatMarkdownBio(member.bio),
                  }}
                />
              </div>
            )}

            {!member.bio && (
              <div className="state-placeholder" style={{ marginTop: 24 }}>
                <p>{t('team.detail.noBio', 'No bio available yet.')}</p>
              </div>
            )}
          </article>
        )}
      </div>
    </section>
  );
}
