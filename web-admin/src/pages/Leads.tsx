import { useState, useEffect } from 'react';
import { leads as leadsApi, ApiClientError } from '../api/client';
import { useToast } from '../components/useToast';
import type { Lead } from '../types';

const STATUS_OPTIONS = ['new', 'contacted', 'converted', 'closed'] as const;
const SOURCE_OPTIONS = ['', 'form', 'chatbot'] as const;

export default function Leads() {
  const { addToast, ToastContainer } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [editingNotes, setEditingNotes] = useState<{ id: string; notes: string } | null>(null);
  const [savingNotes, setSavingNotes] = useState(false);

  const fetchLeads = async () => {
    setLoading(true);
    setError('');
    try {
      const params: { status?: string; source?: string; page: number; pageSize: number } = { page, pageSize: 20 };
      if (statusFilter) params.status = statusFilter;
      if (sourceFilter) params.source = sourceFilter;
      const res = await leadsApi.list(params);
      setLeads(res.data as Lead[]);
      setTotalPages(res.pagination?.totalPages ?? 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLeads(); }, [statusFilter, sourceFilter, page]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await leadsApi.patch(id, { status: newStatus });
      addToast(`Lead status updated to ${newStatus}`, 'success');
      fetchLeads();
    } catch (e) {
      addToast(e instanceof ApiClientError ? e.message : 'Failed to update lead status', 'error');
    }
  };

  const handleSaveNotes = async () => {
    if (!editingNotes) return;
    setSavingNotes(true);
    try {
      await leadsApi.patch(editingNotes.id, { notes: editingNotes.notes });
      addToast('Notes saved', 'success');
      setEditingNotes(null);
      fetchLeads();
    } catch (e) {
      addToast(e instanceof ApiClientError ? e.message : 'Failed to save notes', 'error');
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <div>
      <ToastContainer />
      <div className="page-header">
        <div>
          <h1 className="page-title">Leads</h1>
          <p className="page-subtitle">Manage incoming inquiries from the public site and chatbot.</p>
        </div>
      </div>

      <div className="filter-bar">
        <select className="form-select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="form-select" value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}>
          <option value="">All sources</option>
          {SOURCE_OPTIONS.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {error && <div className="alert alert--error" role="alert">{error}</div>}

      <div className="card">
        <div className="card-body card-body--flush">
          {loading ? (
            <div className="page-loader">
              <div className="spinner" />
            </div>
          ) : leads.length === 0 ? (
            <div className="state-message">
              <span className="state-message-icon">📬</span>
              <h3>No leads found</h3>
              <p>{statusFilter || sourceFilter ? 'Try adjusting the filters.' : 'Leads will appear here when visitors submit the contact form or chatbot.'}</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Contact</th>
                    <th>Source</th>
                    <th>Status</th>
                    <th>Message</th>
                    <th>Notes</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id}>
                      <td style={{ fontWeight: 600 }}>{lead.name}</td>
                      <td>{lead.contactInfo}</td>
                      <td><span className="badge badge--neutral">{lead.source}</span></td>
                      <td>
                        <select
                          className="form-select"
                          style={{ height: '30px', fontSize: 'var(--font-size-xs)', width: 'auto', minWidth: '110px' }}
                          value={lead.status}
                          onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                        >
                          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={lead.message}>
                        {lead.message}
                      </td>
                      <td>
                        <button
                          className="btn btn--ghost btn--sm"
                          onClick={() => setEditingNotes({ id: lead.id, notes: lead.notes ?? '' })}
                        >
                          {lead.notes ? 'Edit notes' : 'Add notes'}
                        </button>
                      </td>
                      <td>{new Date(lead.createdAt).toLocaleDateString()}</td>
                      <td>{/* status handled above */}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {totalPages > 1 && (
          <div className="card-header" style={{ justifyContent: 'center' }}>
            <div className="form-inline">
              <button className="btn btn--outline btn--sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--content-muted)' }}>Page {page} of {totalPages}</span>
              <button className="btn btn--outline btn--sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Notes Edit Modal */}
      {editingNotes && (
        <div className="modal-backdrop" onClick={() => setEditingNotes(null)} role="dialog" aria-modal="true">
          <div className="modal-panel" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Notes</h2>
              <button className="modal-close" onClick={() => setEditingNotes(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-textarea"
                  rows={5}
                  value={editingNotes.notes}
                  onChange={(e) => setEditingNotes({ ...editingNotes, notes: e.target.value })}
                  maxLength={2000}
                />
              </div>
              <div className="form-actions">
                <button className="btn btn--outline" onClick={() => setEditingNotes(null)}>Cancel</button>
                <button className="btn btn--primary" onClick={handleSaveNotes} disabled={savingNotes}>
                  {savingNotes ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
