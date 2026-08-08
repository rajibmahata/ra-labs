import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, type ProjectDetail } from '../api/client';
import { useI18n } from '../i18n';

function formatMarkdown(md: string): string {
  // Simple markdown-to-HTML for case study body.
  // Handles: headings, bold, italic, code blocks, inline code, links, lists, paragraphs.
  let html = md
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks (fenced)
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_m, lang: string, code: string) =>
      `<pre><code class="language-${lang}">${code.trim()}</code></pre>`
  );

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Headings
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Unordered lists
  html = html.replace(/^[\*\-] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, (match) => {
    // Group consecutive <li> into <ul>
    return `<ul>${match}</ul>`;
  });
  // Fix: wrap groups of <li> not already in <ul>
  html = html.replace(
    /((?:<li>.*?<\/li>\s*)+)/g,
    (match) => {
      if (match.includes('<ul>')) return match;
      return `<ul>${match}</ul>`;
    }
  );

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Paragraphs: wrap lines not already wrapped in a block element
  const lines = html.split('\n');
  const result: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      result.push('');
      continue;
    }
    if (
      trimmed.startsWith('<h') ||
      trimmed.startsWith('<ul') ||
      trimmed.startsWith('</ul') ||
      trimmed.startsWith('<li') ||
      trimmed.startsWith('</li') ||
      trimmed.startsWith('<pre') ||
      trimmed.startsWith('</pre')
    ) {
      result.push(line);
    } else {
      result.push(`<p>${trimmed}</p>`);
    }
  }

  return result.join('\n');
}

export default function WorkDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useI18n();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .getProject(slug)
      .then((res) => {
        if (!cancelled) {
          setProject(res.data);
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

  return (
    <section aria-labelledby="project-title">
      <div className="wrap">
        <Link to="/work" className="back-link">
          &larr; {t('nav.work', 'Work')}
        </Link>

        {/* State: loading */}
        {loading && (
          <div className="state-placeholder" aria-live="polite">
            <div className="spinner" />
            <p>Loading project...</p>
          </div>
        )}

        {/* State: error */}
        {error && !loading && (
          <div className="state-placeholder" role="alert">
            <h3>Project not found</h3>
            <p>{error}</p>
            <Link to="/work" className="cta ghost" style={{ marginTop: 16 }}>
              Back to all work
            </Link>
          </div>
        )}

        {/* State: populated */}
        {!loading && !error && project && (
          <article>
            <header className="work-detail-header">
              <h1 id="project-title">{project.title}</h1>

              <div className="meta-row">
                <span
                  className={`status-badge ${project.status === 'live' ? 'live' : project.status === 'in_build' ? 'in_build' : 'draft'}`}
                >
                  {project.status === 'in_build' ? 'In Build' : project.status}
                </span>

                {project.stackTags.length > 0 && (
                  <div className="tags">
                    {project.stackTags.map((tag) => (
                      <span className="tag" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <p style={{ color: 'var(--text-dim)', fontSize: '15px', maxWidth: '60ch' }}>
                {project.summary}
              </p>

              {project.githubUrl && (
                <a
                  href={project.githubUrl}
                  className="github-link"
                  target="_blank"
                  rel="noopener noreferrer"
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
                  View on GitHub
                </a>
              )}
            </header>

            {project.coverImageUrl && (
              <img
                src={project.coverImageUrl}
                alt={`${project.title} cover`}
                className="work-detail-cover"
              />
            )}

            {project.caseStudyBody && (
              <div className="work-detail-body">
                <div
                  className="markdown-body"
                  dangerouslySetInnerHTML={{
                    __html: formatMarkdown(project.caseStudyBody),
                  }}
                />
              </div>
            )}

            {!project.caseStudyBody && (
              <div className="state-placeholder">
                <p>No detailed case study available for this project yet.</p>
              </div>
            )}
          </article>
        )}
      </div>
    </section>
  );
}
