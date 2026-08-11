import { useEffect, useState } from 'react';
import { audit as auditApi, ApiClientError } from '../api/client';

interface AuditEntry {
  id: string;
  actorId?: string | null;
  actorName?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  details?: string | null;
  ipAddress?: string | null;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  'auth.login': 'Login',
  'admin.create': 'Admin created',
  'admin.status': 'Admin status changed',
  'settings.update': 'Settings updated',
  'project.create': 'Project created',
  'project.update': 'Project updated',
  'project.publish': 'Project published',
  'project.activate': 'Project activated',
  'project.featured': 'Project featured',
  'project.delete': 'Project deleted',
  'draft.review': 'Draft reviewed',
  'rag.ingest': 'RAG ingest',
  'github.sync': 'GitHub sync',
  'team.create': 'Team member created',
  'team.update': 'Team member updated',
  'team.delete': 'Team member deleted',
  'customer.status': 'Customer status changed',
};

const PAGE_SIZE = 25;

export default function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');

  const load = async (p = page) => {
    setLoading(true);
    setError('');
    try {
      const res = await auditApi.list({
        page: p,
        pageSize: PAGE_SIZE,
        action: actionFilter || undefined,
        actorName: actorFilter || undefined,
      });
      setEntries(res.data);
      setTotalPages(res.pagination?.totalPages ?? 1);
      setTotalCount(res.pagination?.totalCount ?? 0);
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 403) {
        setError('Only super admins can view the audit log.');
      } else {
        setError(e instanceof Error ? e.message : 'Failed to load the audit log');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); setPage(1); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter, actorFilter]);

  const formatWhen = (iso: string): string => {
    const date = new Date(iso);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Log</h1>
          <p className="page-subtitle">Privileged actions across the platform (super admin only).</p>
        </div>
      </div>

      {error && <div className="alert alert--error" role="alert">{error}</div>}

      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="card-body">
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Action</label>
              <input className="form-input" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} placeholder="e.g. project.create" />
            </div>
            <div className="form-group">
              <label className="form-label">Actor</label>
              <input className="form-input" value={actorFilter} onChange={(e) => setActorFilter(e.target.value)} placeholder="Name or email" />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Entries</h2>
          <span className="badge">{totalCount} total</span>
        </div>
        <div className="card-body card-body--flush">
          {loading ? (
            <div className="page-loader"><div className="spinner" /></div>
          ) : entries.length === 0 ? (
            <div className="state-message">
              <span className="state-message-icon">🛡️</span>
              <h3>No audit entries</h3>
              <p>Privileged actions will be recorded here as they happen.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Details</th>
                    <th>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatWhen(entry.createdAt)}</td>
                      <td>{entry.actorName ?? '—'}</td>
                      <td><span className="badge">{ACTION_LABELS[entry.action] ?? entry.action}</span></td>
                      <td>{entry.entityType ? `${entry.entityType}${entry.entityId ? ` · ${entry.entityId.slice(0, 8)}` : ''}` : '—'}</td>
                      <td style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={entry.details ?? ''}>{entry.details ?? '—'}</td>
                      <td>{entry.ipAddress ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {totalPages > 1 && (
          <div className="card-footer pagination">
            <button className="btn btn--sm btn--outline" disabled={page <= 1} onClick={() => { const next = page - 1; setPage(next); load(next); }}>
              Previous
            </button>
            <span>Page {page} of {totalPages}</span>
            <button className="btn btn--sm btn--outline" disabled={page >= totalPages} onClick={() => { const next = page + 1; setPage(next); load(next); }}>
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
