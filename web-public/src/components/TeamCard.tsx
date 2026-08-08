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

  const stats = snapshot
    ? [
        { value: snapshot.commits90d.toLocaleString(), label: 'commits, 90d' },
        { value: String(snapshot.activeRepos), label: 'active repos' },
        { value: formatRelativeTime(snapshot.lastCommitAt), label: 'last commit' },
      ]
    : [
        { value: '\u2014', label: 'commits, 90d' },
        { value: '\u2014', label: 'active repos' },
        { value: '\u2014', label: 'last commit' },
      ];

  return (
    <Link
      to={`/team/${encodeURIComponent(member.slug)}`}
      className="person"
      style={{ textDecoration: 'none', color: 'inherit' }}
      aria-label={`View profile: ${member.name}`}
    >
      <div
        className={`avatar ${avatarClassForIndex(index)}`}
        aria-hidden="true"
      >
        {member.avatarUrl ? (
          <img src={member.avatarUrl} alt="" />
        ) : (
          getInitials(member.name)
        )}
      </div>

      <div style={{ flex: 1 }}>
        <h3>{member.name}</h3>
        <div className="role">{member.role}</div>

        <div className="team-stats">
          {stats.map((stat, i) => (
            <div className="team-stat" key={i}>
              <b>{stat.value}</b>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </Link>
  );
}

// Export helpers for TeamDetail reuse
export { getInitials, formatRelativeTime, AVATAR_CLASSES, avatarClassForIndex };
