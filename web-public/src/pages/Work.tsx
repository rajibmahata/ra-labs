import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, type ProjectSummary } from '../api/client';
import { useI18n } from '../i18n';
import ProjectCard from '../components/ProjectCard';

export default function Work() {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentTag = searchParams.get('tag') || '';

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch projects
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .getProjects({ pageSize: 50, tag: currentTag || undefined })
      .then((res) => {
        if (!cancelled) {
          setProjects(res.data ?? []);
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
  }, [currentTag]);

  // Collect unique tags from all projects
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const project of projects) {
      for (const tag of project.stackTags) {
        tagSet.add(tag);
      }
    }
    return Array.from(tagSet).sort();
  }, [projects]);

  function handleTagClick(tag: string) {
    if (tag === currentTag) {
      setSearchParams({});
    } else {
      setSearchParams({ tag });
    }
  }

  return (
    <section aria-labelledby="work-heading">
      <div className="wrap">
        <div className="section-head">
          <div>
            <div className="eyebrow">
              {t('portfolio.eyebrow', 'Our work')}
            </div>
            <h2 id="work-heading">
              {t('portfolio.title', 'Systems we have built')}
            </h2>
          </div>
        </div>

        {/* Tag filter bar */}
        {allTags.length > 0 && (
          <div className="filter-bar" role="group" aria-label="Filter by technology">
            {allTags.map((tag) => (
              <button
                key={tag}
                className={`tag ${tag === currentTag ? 'active-tag' : ''}`}
                onClick={() => handleTagClick(tag)}
                type="button"
                aria-pressed={tag === currentTag}
              >
                {tag}
              </button>
            ))}
            {currentTag && (
              <button
                className="tag"
                onClick={() => setSearchParams({})}
                type="button"
                aria-label="Clear filter"
              >
                &times; clear
              </button>
            )}
          </div>
        )}

        {/* State: loading */}
        {loading && (
          <div className="state-placeholder" aria-live="polite">
            <div className="spinner" />
            <p>Loading projects...</p>
          </div>
        )}

        {/* State: error */}
        {error && !loading && (
          <div className="state-placeholder" role="alert">
            <h3>Could not load projects</h3>
            <p>{error}</p>
          </div>
        )}

        {/* State: empty */}
        {!loading && !error && projects.length === 0 && (
          <div className="state-placeholder">
            <h3>
              {currentTag
                ? `No projects tagged "${currentTag}"`
                : 'No projects yet'}
            </h3>
            <p>
              {currentTag
                ? 'Try a different filter or check back later.'
                : 'Our portfolio is coming soon. Check back for updates.'}
            </p>
          </div>
        )}

        {/* State: populated */}
        {!loading && !error && projects.length > 0 && (
          <div className="card-grid">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
