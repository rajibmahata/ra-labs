import type { GithubRepositorySummary } from '../api/client';

interface Props {
  repository: GithubRepositorySummary;
  index?: number;
}

export default function GithubRepositoryCard({ repository, index = 0 }: Props) {
  const language = repository.primaryLanguage ?? repository.technologies[0] ?? 'Open source';
  const accent = ['g1', 'g2', 'g3'][index % 3];

  return (
    <a
      href={repository.htmlUrl}
      className="card github-repository-card"
      target="_blank"
      rel="noreferrer"
      aria-label={`View ${repository.fullName} on GitHub`}
    >
      <div className={`cover-gradient ${accent}`} aria-hidden="true" />
      <div className="body">
        <span className="status-badge">GitHub repository</span>
        <h3>{repository.name}</h3>
        <p className="summary">{repository.description ?? `A ${language} project by ${repository.owner}.`}</p>
        <div className="tags">
          {repository.technologies.map((technology) => (
            <span className="tag" key={technology}>{technology}</span>
          ))}
        </div>
        <div className="meta">
          <span>{language}</span>
          <span>View on GitHub &nearr;</span>
        </div>
      </div>
    </a>
  );
}
