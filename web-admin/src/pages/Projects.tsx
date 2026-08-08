import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { customerProjects as cpApi, ApiClientError } from '../api/client';
import { useToast } from '../components/useToast';
import type { CustomerProject } from '../types';

const STATUSES = ['intake', 'prd_draft', 'prd_signed', 'in_build', 'demo', 'delivered', 'closed'] as const;

const STATUS_LABELS: Record<string, string> = {
  intake: 'Intake',
  prd_draft: 'PRD Draft',
  prd_signed: 'PRD Signed',
  in_build: 'In Build',
  demo: 'Demo',
  delivered: 'Delivered',
  closed: 'Closed',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString();
}

export default function Projects() {
  const { addToast, ToastContainer } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [projects, setProjects] = useState<CustomerProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const statusFilter = searchParams.get('status') ?? '';
  const customerFilter = searchParams.get('customerId') ?? '';

  const fetchProjects = async () => {
    setLoading(true);
    setError('');
    try {
      const params: { status?: string; customerId?: string } = {};
      if (statusFilter) params.status = statusFilter;
      if (customerFilter) params.customerId = customerFilter;
      const res = await cpApi.list(params);
      setProjects(res.data as CustomerProject[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProjects(); }, [statusFilter, customerFilter]);

  const handleStatusChange = async (projectId: string, newStatus: string) => {
    try {
      await cpApi.update(projectId, { status: newStatus });
      addToast(`Project status updated to ${STATUS_LABELS[newStatus] ?? newStatus}`, 'success');
      fetchProjects();
    } catch (e) {
      addToast(e instanceof ApiClientError ? e.message : 'Failed to update project status', 'error');
    }
  };

  const projectsByStatus = STATUSES.reduce((acc, status) => {
    acc[status] = projects.filter((p) => p.status === status);
    return acc;
  }, {} as Record<string, CustomerProject[]>);

  return (
    <div>
      <ToastContainer />
      <div className="page-header">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">
            {customerFilter ? `Filtered by customer` : 'Customer projects across all stages.'}
          </p>
        </div>
      </div>

      <div className="filter-bar">
        <select
          className="form-select"
          value={statusFilter}
          onChange={(e) => {
            const params = new URLSearchParams(searchParams);
            if (e.target.value) params.set('status', e.target.value);
            else params.delete('status');
            setSearchParams(params, { replace: true });
          }}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        {customerFilter && (
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => {
              const params = new URLSearchParams(searchParams);
              params.delete('customerId');
              setSearchParams(params, { replace: true });
            }}
          >
            Clear customer filter
          </button>
        )}
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--content-muted)', marginLeft: 'auto' }}>
          {projects.length} project{projects.length !== 1 ? 's' : ''}
        </span>
      </div>

      {error && <div className="alert alert--error" role="alert">{error}</div>}

      {loading ? (
        <div className="page-loader">
          <div className="spinner" />
        </div>
      ) : projects.length === 0 ? (
        <div className="card">
          <div className="card-body">
            <div className="state-message" style={{ padding: 0 }}>
              <span className="state-message-icon">📋</span>
              <h3>No projects found</h3>
              <p>{statusFilter || customerFilter ? 'Try adjusting the filters.' : 'Customer projects will appear here when created.'}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="kanban-board">
          {STATUSES.map((status) => {
            const items = projectsByStatus[status] ?? [];
            return (
              <div key={status} className={`kanban-column${statusFilter ? ' kanban-column--filtered' : ''}`}>
                <div className={`kanban-column-header kanban-column-header--${status}`}>
                  <span>{STATUS_LABELS[status]}</span>
                  <span className="kanban-column-count">{items.length}</span>
                </div>
                <div className="kanban-column-body">
                  {items.length === 0 ? (
                    <div className="kanban-empty">No projects</div>
                  ) : (
                    items.map((project) => (
                      <div
                        key={project.id}
                        className="kanban-card"
                        onClick={() => navigate(`/admin/projects/${project.id}`)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/admin/projects/${project.id}`); } }}
                        tabIndex={0}
                        role="link"
                        aria-label={`Open project ${project.title}`}
                      >
                        <div className="kanban-card-title">{project.title}</div>
                        <div className="kanban-card-meta">
                          <span className="kanban-card-customer">Customer: {project.customerId.slice(0, 8)}...</span>
                          {project.prdStatus && (
                            <span className="badge badge--neutral">
                              {project.prdStatus}
                            </span>
                          )}
                        </div>
                        <div className="kanban-card-footer">
                          <span>{project.documentCount} doc{project.documentCount !== 1 ? 's' : ''}</span>
                          <span>{formatDate(project.updatedAt)}</span>
                        </div>
                        <div className="kanban-card-actions" onClick={(e) => e.stopPropagation()}>
                          <select
                            className="form-select"
                            style={{ height: '28px', fontSize: 'var(--font-size-xs)', width: '100%' }}
                            value={project.status}
                            onChange={(e) => handleStatusChange(project.id, e.target.value)}
                            aria-label={`Change status for ${project.title}`}
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
