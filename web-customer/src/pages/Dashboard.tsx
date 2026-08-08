import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, ApiClientError } from '../api/client';
import type { ProjectSummary } from '../types';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [brief, setBrief] = useState({
    title: '',
    goal: '',
    audience: '',
    requirements: '',
    timeline: '',
    budgetOrConstraints: '',
    referenceLinks: '',
  });
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getProjects();
      setProjects(res.data);
    } catch (err) {
      const msg =
        err instanceof ApiClientError ? err.message : 'Failed to load projects.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!brief.title.trim() || !brief.goal.trim()) return;

    setCreating(true);
    setCreateError('');
    try {
      const res = await api.createProject({
        title: brief.title.trim(),
        goal: brief.goal.trim(),
        audience: brief.audience.trim() || undefined,
        requirements: brief.requirements.trim() || undefined,
        timeline: brief.timeline.trim() || undefined,
        budgetOrConstraints: brief.budgetOrConstraints.trim() || undefined,
        referenceLinks: brief.referenceLinks.trim() || undefined,
      });
      setProjects((prev) => [res.data, ...prev]);
      setBrief({ title: '', goal: '', audience: '', requirements: '', timeline: '', budgetOrConstraints: '', referenceLinks: '' });
      setShowModal(false);
      navigate(`/projects/${res.data.id}`);
    } catch (err) {
      const msg =
        err instanceof ApiClientError ? err.message : 'Failed to create project.';
      setCreateError(msg);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p className="welcome">
            Welcome back, {user?.name ?? 'Customer'}.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowModal(true)}
          aria-label="Create new project"
        >
          + New Project
        </button>
      </div>

      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button
            className="btn btn-small btn-ghost"
            onClick={loadProjects}
            style={{ marginLeft: 12 }}
          >
            Retry
          </button>
        </div>
      )}

      {!error && projects.length === 0 && (
        <div className="state-placeholder" role="status">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <h3>No projects yet</h3>
          <p>Create your first project to get started.</p>
          <button
            className="btn btn-primary"
            onClick={() => setShowModal(true)}
            style={{ marginTop: 16 }}
          >
            + New Project
          </button>
        </div>
      )}

      {projects.length > 0 && (
        <div className="project-grid">
          {projects.map((project) => (
            <div
              key={project.id}
              className="project-card"
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/projects/${project.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(`/projects/${project.id}`);
                }
              }}
              aria-label={`Project: ${project.title}`}
            >
              <StatusBadge status={project.status} />
              <h3>{project.title}</h3>
              <div className="meta">
                <span className="doc-count">
                  {project.documentCount} document{project.documentCount !== 1 ? 's' : ''}
                </span>
                <span>
                  {new Date(project.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Project Modal */}
      {showModal && (
        <div
          className="modal-overlay"
          onClick={() => {
            setShowModal(false);
            setBrief({ title: '', goal: '', audience: '', requirements: '', timeline: '', budgetOrConstraints: '', referenceLinks: '' });
            setCreateError('');
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Create new project"
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>New Project</h2>
            <p className="modal-intro">Create a private project workspace and share the context we need to shape the first conversation.</p>
            {createError && (
              <div className="error-banner" role="alert">
                {createError}
              </div>
            )}
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label htmlFor="new-project-title">Project Title</label>
                <input
                  id="new-project-title"
                  type="text"
                  placeholder="e.g. Mobile App Redesign"
                  value={brief.title}
                  onChange={(e) => setBrief((prev) => ({ ...prev, title: e.target.value }))}
                  autoFocus
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="project-goal">What should this project achieve?</label>
                <textarea id="project-goal" rows={3} placeholder="Describe the outcome you want to create." value={brief.goal} onChange={(e) => setBrief((prev) => ({ ...prev, goal: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label htmlFor="project-audience">Who is it for?</label>
                <input id="project-audience" placeholder="Customers, staff, partners, or a specific audience" value={brief.audience} onChange={(e) => setBrief((prev) => ({ ...prev, audience: e.target.value }))} />
              </div>
              <div className="form-group">
                <label htmlFor="project-requirements">Key requirements</label>
                <textarea id="project-requirements" rows={4} placeholder="Features, integrations, workflows, or technical constraints" value={brief.requirements} onChange={(e) => setBrief((prev) => ({ ...prev, requirements: e.target.value }))} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="project-timeline">Timeline</label>
                  <input id="project-timeline" placeholder="e.g. Q4 launch" value={brief.timeline} onChange={(e) => setBrief((prev) => ({ ...prev, timeline: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label htmlFor="project-budget">Budget or constraints</label>
                  <input id="project-budget" placeholder="Range, deadline, or other limits" value={brief.budgetOrConstraints} onChange={(e) => setBrief((prev) => ({ ...prev, budgetOrConstraints: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="project-references">Reference links</label>
                <input id="project-references" type="url" placeholder="Briefs, examples, repositories, or relevant URLs" value={brief.referenceLinks} onChange={(e) => setBrief((prev) => ({ ...prev, referenceLinks: e.target.value }))} />
                <small className="form-hint">You can continue the conversation and add documents from the project room.</small>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowModal(false);
                    setBrief({ title: '', goal: '', audience: '', requirements: '', timeline: '', budgetOrConstraints: '', referenceLinks: '' });
                    setCreateError('');
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={creating || !brief.title.trim() || !brief.goal.trim()}
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
