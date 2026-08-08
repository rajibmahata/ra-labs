import { Link } from 'react-router-dom';
import type { ProjectSummary } from '../api/client';

interface Props {
  project: ProjectSummary;
}

const GRADIENT_PALETTES = [
  'linear-gradient(135deg, #00d4a8, #006b52)',
  'linear-gradient(135deg, #008566, #003d2e)',
  'linear-gradient(135deg, #00b894, #009b7a)',
  'linear-gradient(135deg, #e2b04a, #8b6914)',
  'linear-gradient(135deg, #00d4a8, #8b6914)',
];

function gradientForIndex(index: number): string {
  return GRADIENT_PALETTES[index % GRADIENT_PALETTES.length];
}

export default function ProjectCard({ project }: Props) {
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
            className="cover-gradient"
            style={{ background: gradientForIndex(0) }}
            aria-hidden="true"
          />
        )}
      </div>

      <div className="body">
        <div className="status-row">
          <span
            className={`status-badge ${project.status === 'live' ? 'live' : project.status === 'in_build' ? 'in_build' : 'draft'}`}
          >
            {project.status === 'in_build' ? 'In Build' : project.status}
          </span>
        </div>

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
          <span>
            {project.createdAt
              ? new Date(project.createdAt).toLocaleDateString()
              : ''}
          </span>
          <span aria-hidden="true">view &rarr;</span>
        </div>
      </div>
    </Link>
  );
}

// Named export for the gradient helper (used by WorkDetail)
export { gradientForIndex };
