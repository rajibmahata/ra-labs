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
  const [newTitle, setNewTitle] = useState('');
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
    if (!newTitle.trim()) return;

    setCreating(true);
    setCreateError('');
    try {
      const res = await api.createProject({ title: newTitle.trim() });
      setProjects((prev) => [res.data, ...prev]);
      setNewTitle('');
      setShowModal(false);
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
            setNewTitle('');
            setCreateError('');
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Create new project"
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>New Project</h2>
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
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowModal(false);
                    setNewTitle('');
                    setCreateError('');
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={creating || !newTitle.trim()}
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
