import { Link } from 'react-router-dom';
import type { TeamMember } from '../api/client';

interface Props {
  member: TeamMember;
}

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #00d4a8, #008566)',
  'linear-gradient(135deg, #e2b04a, #8b6914)',
  'linear-gradient(135deg, #4a90d9, #2a5f8f)',
  'linear-gradient(135deg, #e85d75, #9b2a3e)',
];

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

export default function TeamCard({ member }: Props) {
  const snapshot = member.githubSnapshot;

  return (
    <Link
      to={`/team/${encodeURIComponent(member.slug)}`}
      className="card"
      style={{ textDecoration: 'none', color: 'inherit', overflow: 'visible' }}
      aria-label={`View profile: ${member.name}`}
    >
      <div
        className="body"
        style={{ flexDirection: 'row', gap: '18px', alignItems: 'flex-start', padding: '26px' }}
      >
        <div
          className="avatar team-avatar-large"
          style={{
            width: '56px',
            height: '56px',
            fontSize: '18px',
            background:
              AVATAR_GRADIENTS[
                member.name.length % AVATAR_GRADIENTS.length
              ],
          }}
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

        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: '17px' }}>{member.name}</h3>
          <div
            style={{
              fontSize: '12.5px',
              color: 'var(--brass)',
              fontWeight: 600,
              marginTop: '3px',
            }}
          >
            {member.role}
          </div>

          {snapshot && (
            <div className="team-stats" style={{ marginTop: '14px', gap: '18px' }}>
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
    </Link>
  );
}

// Export helpers for TeamDetail reuse
export { getInitials, formatRelativeTime, AVATAR_GRADIENTS };
