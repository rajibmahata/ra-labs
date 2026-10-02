import { useMemo, useState, useEffect, useRef } from 'react';
import { leads as leadsApi, ApiClientError } from '../api/client';
import { useToast } from '../components/useToast';
import { Pagination } from '../components/Pagination';
import { SortableTh, type SortDirection } from '../components/SortableTh';
import type { Lead } from '../types';

const STATUS_OPTIONS = ['new', 'contacted', 'converted', 'closed'] as const;
const SOURCE_OPTIONS = ['', 'form', 'chatbot'] as const;

function sortRows(rows: Lead[], sortKey: string, direction: SortDirection): Lead[] {
  const dir = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = (a as unknown as Record<string, string>)[sortKey] ?? '';
    const bv = (b as unknown as Record<string, string>)[sortKey] ?? '';
    if (sortKey === 'createdAt') return (new Date(av).getTime() - new Date(bv).getTime()) * dir;
    return String(av).localeCompare(String(bv)) * dir;
  });
}

export default function Leads() {
  const { addToast, ToastContainer } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [sortKey, setSortKey] = useState('');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [editingNotes, setEditingNotes] = useState<{ id: string; notes: string } | null>(null);
  const [savingNotes, setSavingNotes] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = async (file: File) => {
    try {
      const res = await leadsApi.importCsv(file);
      const summary = res.data;
      addToast(`Import: ${summary.created} created, ${summary.skipped} skipped${summary.errors.length ? `, ${summary.errors.length} errors` : ''}`, summary.errors.length ? 'error' : 'success');
      fetchLeads();
    } catch (e) {
      addToast(e instanceof ApiClientError ? e.message : 'Failed to import CSV', 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExport = async () => {
    try {
      const blob = await leadsApi.exportCsv({ status: statusFilter || undefined, source: sourceFilter || undefined });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'leads.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      addToast(e instanceof ApiClientError ? e.message : 'Failed to export CSV', 'error');
    }
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const visibleRows = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    const filtered = q
      ? leads.filter((l) =>
          [l.name, l.contactInfo, l.source, l.message, l.status, l.notes ?? ''].some((v) => v.toLowerCase().includes(q)),
        )
      : leads;
    return sortKey ? sortRows(filtered, sortKey, sortDirection) : filtered;
  }, [leads, searchFilter, sortKey, sortDirection]);

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
      setTotalCount(res.pagination?.totalCount ?? res.data.length);
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
        <div className="form-inline">
          <button className="btn btn--outline" onClick={handleExport}>Export CSV</button>
          <button className="btn btn--outline" onClick={() => fileInputRef.current?.click()}>Import CSV</button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            aria-label="Import leads CSV"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImport(f); }}
          />
        </div>
      </div>

      <div className="filter-bar">
        <input
          className="form-input"
          style={{ minWidth: '200px' }}
          value={searchFilter}
          placeholder="Search name, contact, message..."
          aria-label="Search leads"
          onChange={(e) => setSearchFilter(e.target.value)}
        />
        <select className="form-select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="form-select" value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}>
          <option value="">All sources</option>
          {SOURCE_OPTIONS.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--content-muted)', marginLeft: 'auto' }}>
          {visibleRows.length} lead{visibleRows.length !== 1 ? 's' : ''} shown
        </span>
      </div>

      {error && <div className="alert alert--error" role="alert">{error}</div>}

      <div className="card">
        <div className="card-body card-body--flush">
          {loading ? (
            <div className="page-loader">
              <div className="spinner" />
            </div>
          ) : visibleRows.length === 0 ? (
            <div className="state-message">
              <span className="state-message-icon">📬</span>
              <h3>No leads found</h3>
              <p>{statusFilter || sourceFilter || searchFilter ? 'Try adjusting the filters.' : 'Leads will appear here when visitors submit the contact form or chatbot.'}</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <SortableTh label="Name" sortKey="name" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
                    <SortableTh label="Contact" sortKey="contactInfo" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
                    <SortableTh label="Source" sortKey="source" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
                    <SortableTh label="Status" sortKey="status" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
                    <th>Message</th>
                    <th>Notes</th>
                    <SortableTh label="Date" sortKey="createdAt" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((lead) => (
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
          <Pagination page={page} pageSize={20} totalCount={totalCount} onPageChange={setPage} />
        )}
      </div>

      {editingNotes && (
        <div className="card inline-edit-panel" role="region" aria-label="Edit notes">
          <div className="inline-edit-panel-title">
            <h2 className="page-title">Edit Notes</h2>
          </div>
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
      )}
    </div>
  );
}
