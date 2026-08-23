import { Link } from 'react-router-dom';
import type { TeamMember } from '../api/client';

interface Props {
  member: TeamMember;
  /** Card index in the grid, used for round-robin avatar gradient assignment (0-based). */
  index?: number;
}

const AVATAR_CLASSES = ['a1', 'a2'] as const;

function avatarClassForIndex(index: number): string {
  return AVATAR_CLASSES[index % AVATAR_CLASSES.length];
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(isoString).toLocaleDateString();
}

export default function TeamCard({ member, index = 0 }: Props) {
  const snapshot = member.githubSnapshot;

  return (
    <Link
      to={`/team/${encodeURIComponent(member.slug)}`}
      className="person"
      aria-label={`View profile: ${member.name}`}
    >
      <div className={`person-avatar avatar ${avatarClassForIndex(index)}`} aria-hidden="true">
        {member.avatarUrl ? (
          <img src={member.avatarUrl} alt="" loading="lazy" />
        ) : (
          getInitials(member.name)
        )}
      </div>

      <div className="person-body">
        <h3>{member.name}</h3>
        <div className="role">{member.role}</div>

        {member.bio && (
          <p className="person-bio">
            {member.bio.replace(/[*`#>[\]()]/g, '').split('\n')[0].slice(0, 140)}
            {(member.bio.length > 140) ? '\u2026' : ''}
          </p>
        )}

        <div className="team-stats">
          {snapshot ? (
            <>
              <div className="team-stat">
                <b>{snapshot.commits90d.toLocaleString()}</b>
                <span>commits · 90d</span>
              </div>
              <div className="team-stat">
                <b>{snapshot.activeRepos}</b>
                <span>active repos</span>
              </div>
              <div className="team-stat">
                <b>{formatRelativeTime(snapshot.lastCommitAt)}</b>
                <span>last commit</span>
              </div>
            </>
          ) : (
            <div className="team-stat">
              <b>&mdash;</b>
              <span>GitHub sync pending</span>
            </div>
          )}
        </div>

        <span className="person-cta">View profile &rarr;</span>
      </div>
    </Link>
  );
}

// Export helpers for other pages
export { getInitials, formatRelativeTime, AVATAR_CLASSES, avatarClassForIndex };
