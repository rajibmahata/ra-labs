import type { ProjectStatus } from '../types';

interface StatusBadgeProps {
  status: ProjectStatus;
}

const LABELS: Record<ProjectStatus, string> = {
  intake: 'Intake',
  prd_draft: 'PRD Draft',
  prd_signed: 'PRD Signed',
  in_build: 'In Build',
  demo: 'Demo',
  delivered: 'Delivered',
  closed: 'Closed',
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`status-badge status-${status}`} aria-label={`Status: ${LABELS[status]}`}>
      <span className="dot" aria-hidden="true" />
      {LABELS[status]}
    </span>
  );
}
