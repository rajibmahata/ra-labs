import { Link } from 'react-router-dom';
import type { ProjectSummary } from '../api/client';

interface Props {
  project: ProjectSummary;
  /** Card index in the grid, used for round-robin gradient assignment (0-based). */
  index?: number;
}

const GRADIENT_CLASSES = ['g1', 'g2', 'g3'] as const;

function gradientClassForIndex(index: number): string {
  return GRADIENT_CLASSES[index % GRADIENT_CLASSES.length];
}

/**
 * Formats a build-time string. Returns the value if truthy,
 * otherwise "in progress" as a fallback.
 */
function formatBuildTime(project: ProjectSummary): string {
  if (project.createdAt) {
    const date = new Date(project.createdAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMonths = Math.max(1, Math.round(diffMs / (30 * 24 * 60 * 60 * 1000)));
    return `${diffMonths} mo build`;
  }
  return 'in progress';
}

export default function ProjectCard({ project, index = 0 }: Props) {
  return (
    <Link
      to={`/work/${encodeURIComponent(project.slug)}`}
      className="card"
      style={{ textDecoration: 'none', color: 'inherit' }}
      aria-label={`View project: ${project.title}`}
    >
      <div className="cover">
        {project.coverImageUrl ? (
          <img
            src={project.coverImageUrl}
            alt=""
            loading="lazy"
          />
        ) : (
          <div
            className={`cover-gradient ${gradientClassForIndex(index)}`}
            aria-hidden="true"
          />
        )}
      </div>

      <div className="body">
        <span className="status-badge">
          {project.status === 'in_build' ? 'In Build' : project.status}
        </span>

        <h3>{project.title}</h3>
        <p className="summary">{project.summary}</p>

        {project.stackTags.length > 0 && (
          <div className="tags">
            {project.stackTags.map((tag) => (
              <span className="tag" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="meta">
          <span>{formatBuildTime(project)}</span>
          <span>github &nearr;</span>
        </div>
      </div>
    </Link>
  );
}

// Named export for the gradient helper (used by WorkDetail if needed)
export { gradientClassForIndex };
