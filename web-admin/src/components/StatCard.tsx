import type { ReactNode } from 'react';

type Tone = 'default' | 'success' | 'warning' | 'danger' | 'info';

const TONE_CLASS: Record<Tone, string> = {
  default: '',
  success: 'stat-card--success',
  warning: 'stat-card--warning',
  danger: 'stat-card--danger',
  info: 'stat-card--info',
};

export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = 'default',
  to,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  to?: string;
}) {
  const content = (
    <>
      <div className="stat-card-top">
        <span className="stat-card-label">{label}</span>
        {icon && <span className="stat-card-icon" aria-hidden="true">{icon}</span>}
      </div>
      <span className="stat-card-value">{value}</span>
      {sub !== undefined && <span className="stat-card-sub">{sub}</span>}
    </>
  );
  return (
    <div className={`stat-card ${TONE_CLASS[tone]}`}>
      {to ? (
        <a className="stat-card-link" href={to}>
          {content}
        </a>
      ) : (
        content
      )}
    </div>
  );
}
