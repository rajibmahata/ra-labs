import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { customerProjects as cpApi, ApiClientError } from '../api/client';
import { useToast } from '../components/useToast';
import type { Customer } from '../types';

function useFocusPanel(open: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open && ref.current) {
      const first = ref.current.querySelector<HTMLElement>('input, select, textarea, button, h2');
      first?.focus();
    }
  }, [open]);
  return ref;
}

type BulkKind = 'activate' | 'deactivate' | 'delete';

export default function Customers() {
  const { addToast, ToastContainer } = useToast();
  const navigate = useNavigate();

  // --- data state ---
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [saving, setSaving] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  // --- selection ---
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState<{ ids: string[]; kind: BulkKind } | null>(null);

  // --- search / filter ---
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(''); // '' = all, 'true' = active, 'false' = inactive
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  // --- panels ---
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', password: '' });
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '' });

  // --- hidden file input for import ---
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- panel focus refs ---
  const addPanelRef = useFocusPanel(showAddPanel);
  const viewPanelRef = useFocusPanel(!!viewingCustomer);
  const editPanelRef = useFocusPanel(!!editingCustomer);

  // ---------------------------------------------------------------------------
  // fetch
  // ---------------------------------------------------------------------------
  const fetchCustomers = async () => {
    setLoading(true);
    setError('');
    try {
      const params: { page: number; pageSize: number; search?: string; isActive?: boolean } = {
        page,
        pageSize: 20,
      };
      if (search.trim()) params.search = search.trim();
      if (statusFilter === 'true') params.isActive = true;
      else if (statusFilter === 'false') params.isActive = false;

      const res = await cpApi.listCustomers(params);
      setCustomers(res.data as Customer[]);
      setTotalCount(res.pagination?.totalCount ?? res.data.length);
      setTotalPages(res.pagination?.totalPages ?? 1);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  // refetch on page / filter change
  useEffect(() => {
    fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter]);

  // debounced search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      fetchCustomers();
    }, 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // ---------------------------------------------------------------------------
  // selection helpers
  // ---------------------------------------------------------------------------
  const toggleSelected = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectAll = () =>
    setSelected((current) =>
      current.size === customers.length ? new Set() : new Set(customers.map((c) => c.id)),
    );

  // ---------------------------------------------------------------------------
  // row actions — activate / deactivate (immediate, no popup)
  // ---------------------------------------------------------------------------
  const handleSetStatus = async (id: string, isActive: boolean) => {
    try {
      await cpApi.setStatus(id, isActive);
      addToast(isActive ? 'Customer activated' : 'Customer deactivated', 'success');
      await fetchCustomers();
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Failed to update status', 'error');
    }
  };

  // ---------------------------------------------------------------------------
  // row delete — inline confirm in the actions cell
  // ---------------------------------------------------------------------------
  const handleDeleteRow = async (id: string) => {
    setDeleteSaving(true);
    try {
      setTotalCount((p) => Math.max(0, p - 1));
      await cpApi.deleteCustomer(id);
      addToast('Customer deleted', 'success');
      setDeletingId(null);
      await fetchCustomers();
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Failed to delete customer', 'error');
    } finally {
      setDeleteSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // view customer — inline read-only panel
  // ---------------------------------------------------------------------------
  const openView = (customer: Customer) => {
    setViewingCustomer(customer);
    setEditingCustomer(null);
    setShowAddPanel(false);
  };

  // ---------------------------------------------------------------------------
  // edit customer — inline form panel
  // ---------------------------------------------------------------------------
  const openEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setEditForm({ name: customer.name, email: customer.email, password: '' });
    setViewingCustomer(null);
    setShowAddPanel(false);
  };

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    setSaving(true);
    try {
      const payload: { name: string; email: string; password?: string } = {
        name: editForm.name,
        email: editForm.email,
      };
      if (editForm.password) payload.password = editForm.password;
      await cpApi.updateCustomer(editingCustomer.id, payload);
      addToast('Customer updated', 'success');
      setEditingCustomer(null);
      await fetchCustomers();
    } catch (e) {
      addToast(e instanceof ApiClientError ? e.message : 'Failed to update customer', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // add customer — inline form panel
  // ---------------------------------------------------------------------------
  const openAddPanel = () => {
    setShowAddPanel(true);
    setCreateForm({ name: '', email: '', password: '' });
    setViewingCustomer(null);
    setEditingCustomer(null);
  };

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await cpApi.createCustomer(createForm);
      addToast('Customer account created', 'success');
      setShowAddPanel(false);
      setCreateForm({ name: '', email: '', password: '' });
      await fetchCustomers();
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Failed to create customer', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // import / export
  // ---------------------------------------------------------------------------
  const handleImport = async (file: File) => {
    try {
      const res = await cpApi.importCustomers(file);
      const summary = res.data;
      const msgs: string[] = [];
      if (summary.created > 0) msgs.push(`${summary.created} created`);
      if (summary.skipped > 0) msgs.push(`${summary.skipped} skipped`);
      if (summary.errors?.length) msgs.push(`${summary.errors.length} error(s)`);
      addToast(`Import complete: ${msgs.join(', ') || '0 processed'}`, summary.errors?.length ? 'error' : 'success');
      await fetchCustomers();
    } catch (e) {
      addToast(e instanceof ApiClientError ? e.message : 'Failed to import customers', 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExport = async () => {
    try {
      const params: { ids?: string[]; search?: string; isActive?: boolean } = {};
      if (selected.size > 0) {
        params.ids = [...selected];
      } else {
        if (search.trim()) params.search = search.trim();
        if (statusFilter === 'true') params.isActive = true;
        else if (statusFilter === 'false') params.isActive = false;
      }
      const blob = await cpApi.exportCustomers(params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'customers.csv';
      a.click();
      URL.revokeObjectURL(url);
      addToast('Export downloaded', 'success');
    } catch (e) {
      addToast(e instanceof ApiClientError ? e.message : 'Failed to export customers', 'error');
    }
  };

  // ---------------------------------------------------------------------------
  // bulk actions — inline confirm bar (NO popup)
  // ---------------------------------------------------------------------------
  const openBulkConfirm = (kind: BulkKind) => {
    if (selected.size === 0) return;
    setBulkConfirm({ ids: [...selected], kind });
  };

  const executeBulkAction = async () => {
    if (!bulkConfirm) return;
    setBulkSaving(true);
    try {
      const { ids, kind } = bulkConfirm;
      if (kind === 'activate') {
        await Promise.all(ids.map((id) => cpApi.setStatus(id, true)));
        addToast(`${ids.length} customer(s) activated`, 'success');
      } else if (kind === 'deactivate') {
        await Promise.all(ids.map((id) => cpApi.setStatus(id, false)));
        addToast(`${ids.length} customer(s) deactivated`, 'success');
      } else if (kind === 'delete') {
        setTotalCount((p) => Math.max(0, p - ids.length));
        await cpApi.bulkDeleteCustomers(ids);
        addToast(`${ids.length} customer(s) deleted`, 'success');
      }
      setBulkConfirm(null);
      await fetchCustomers();
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Bulk action failed', 'error');
    } finally {
      setBulkSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // render
  // ---------------------------------------------------------------------------
  const selectedCount = selected.size;

  return (
    <div>
      <ToastContainer />

      {/* ── page header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">Registered customers and their active projects.</p>
        </div>
      </div>

      {/* ── toolbar ── */}
      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <div className="form-inline">
          <button className="btn btn--primary" onClick={openAddPanel}>
            ＋ Add Customer
          </button>
          <button className="btn btn--outline" onClick={handleExport}>
            ⇩ Export CSV
          </button>
          <button
            className="btn btn--outline"
            onClick={() => fileInputRef.current?.click()}
          >
            ⇧ Import CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            aria-label="Import customers CSV"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleImport(f);
            }}
          />

          {/* separator */}
          <span style={{ width: 1, height: 24, background: 'var(--surface-border)', margin: '0 4px' }} />

          <button
            className="btn btn--outline btn--sm"
            disabled={selectedCount === 0}
            onClick={() => openBulkConfirm('activate')}
          >
            Activate selected
          </button>
          <button
            className="btn btn--outline btn--sm"
            disabled={selectedCount === 0}
            onClick={() => openBulkConfirm('deactivate')}
          >
            Deactivate selected
          </button>
          <button
            className="btn btn--ghost btn--sm"
            style={{ color: 'var(--color-danger)' }}
            disabled={selectedCount === 0}
            onClick={() => openBulkConfirm('delete')}
          >
            Delete selected
          </button>

          {selectedCount > 0 && (
            <span
              style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--content-muted)',
                fontWeight: 600,
              }}
            >
              {selectedCount} selected
            </span>
          )}
        </div>

        <div className="form-inline">
          <input
            className="form-input"
            style={{ minWidth: '180px' }}
            value={search}
            placeholder="Search customers..."
            aria-label="Search customers"
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="form-select"
            value={statusFilter}
            style={{ minWidth: '120px' }}
            aria-label="Filter by status"
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
              setSelected(new Set());
            }}
          >
            <option value="">All statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          <span
            style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--content-muted)',
              whiteSpace: 'nowrap',
            }}
          >
            {totalCount} customer{totalCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* ── global error ── */}
      {error && (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      )}

      {/* ── bulk confirm bar (inline, NO popup) ── */}
      {bulkConfirm && (
        <div
          className="inline-confirm-bar"
          style={
            bulkConfirm.kind === 'delete'
              ? { borderLeftColor: 'var(--color-danger)', background: '#fef2f2' }
              : undefined
          }
          role="alert"
        >
          <span>
            {bulkConfirm.kind === 'activate' && (
              <>Activate <strong>{bulkConfirm.ids.length}</strong> customer(s)?</>
            )}
            {bulkConfirm.kind === 'deactivate' && (
              <>Deactivate <strong>{bulkConfirm.ids.length}</strong> customer(s)?</>
            )}
            {bulkConfirm.kind === 'delete' && (
              <>Delete <strong>{bulkConfirm.ids.length}</strong> customer(s)? This cannot be undone.</>
            )}
          </span>
          <div className="form-inline">
            <button
              type="button"
              className="btn btn--outline btn--sm"
              disabled={bulkSaving}
              onClick={() => setBulkConfirm(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`btn btn--sm ${bulkConfirm.kind === 'delete' ? 'btn--danger' : 'btn--primary'}`}
              disabled={bulkSaving}
              onClick={() => void executeBulkAction()}
            >
              {bulkSaving
                ? '…'
                : bulkConfirm.kind === 'delete'
                  ? 'Delete'
                  : 'Confirm'}
            </button>
          </div>
        </div>
      )}

      {/* ── add customer inline panel ── */}
      {showAddPanel && (
        <div className="card inline-edit-panel" role="region" aria-label="Add customer" ref={addPanelRef}>
          <form onSubmit={handleCreateSubmit}>
            <div className="inline-edit-panel-title">
              <h2 className="page-title" tabIndex={-1}>Add Customer</h2>
            </div>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input
                className="form-input"
                required
                maxLength={100}
                value={createForm.name}
                onChange={(e) =>
                  setCreateForm((c) => ({ ...c, name: e.target.value }))
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input
                className="form-input"
                required
                type="email"
                maxLength={200}
                value={createForm.email}
                onChange={(e) =>
                  setCreateForm((c) => ({ ...c, email: e.target.value }))
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">Temporary password *</label>
              <input
                className="form-input"
                required
                type="password"
                minLength={8}
                value={createForm.password}
                onChange={(e) =>
                  setCreateForm((c) => ({ ...c, password: e.target.value }))
                }
                autoComplete="new-password"
              />
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => setShowAddPanel(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? 'Creating...' : 'Create customer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── view customer inline detail panel ── */}
      {viewingCustomer && (
        <div
          className="card inline-edit-panel"
          role="region"
          aria-label={`Viewing ${viewingCustomer.name}`}
          ref={viewPanelRef}
        >
          <div className="inline-edit-panel-title">
            <h2 className="page-title" tabIndex={-1}>
              {viewingCustomer.name}
            </h2>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => setViewingCustomer(null)}
            >
              Close
            </button>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Email</label>
              <div style={{ padding: 'var(--space-2) 0', fontSize: 'var(--font-size-sm)' }}>
                {viewingCustomer.email}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <div style={{ padding: 'var(--space-2) 0' }}>
                <span
                  className={`badge ${viewingCustomer.isActive ? 'badge--published' : 'badge--unpublished'}`}
                >
                  {viewingCustomer.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Projects</label>
              <div style={{ padding: 'var(--space-2) 0' }}>
                <span
                  className={`badge ${viewingCustomer.projectCount > 0 ? 'badge--live' : 'badge--neutral'}`}
                >
                  {viewingCustomer.projectCount}
                </span>
                {viewingCustomer.projectCount > 0 && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    style={{ marginLeft: 'var(--space-2)' }}
                    onClick={() =>
                      navigate(`/admin/projects?customerId=${viewingCustomer.id}`)
                    }
                  >
                    View projects →
                  </button>
                )}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Registered</label>
              <div
                style={{
                  padding: 'var(--space-2) 0',
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--content-muted)',
                }}
              >
                {new Date(viewingCustomer.createdAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </div>
            </div>
            {viewingCustomer.updatedAt && (
              <div className="form-group">
                <label className="form-label">Last Updated</label>
                <div
                  style={{
                    padding: 'var(--space-2) 0',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--content-muted)',
                  }}
                >
                  {new Date(viewingCustomer.updatedAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── edit customer inline form panel ── */}
      {editingCustomer && (
        <div
          className="card inline-edit-panel"
          role="region"
          aria-label={`Editing ${editingCustomer.name}`}
          ref={editPanelRef}
        >
          <form onSubmit={handleEditSubmit}>
            <div className="inline-edit-panel-title">
              <h2 className="page-title" tabIndex={-1}>Edit Customer — {editingCustomer.name}</h2>
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={() => setEditingCustomer(null)}
              >
                Cancel
              </button>
            </div>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input
                className="form-input"
                required
                maxLength={100}
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input
                className="form-input"
                required
                type="email"
                maxLength={200}
                value={editForm.email}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password (leave blank to keep current)</label>
              <input
                className="form-input"
                type="password"
                minLength={8}
                value={editForm.password}
                placeholder="New password (optional)"
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, password: e.target.value }))
                }
                autoComplete="new-password"
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── table card ── */}
      <div className="card">
        <div className="card-body card-body--flush">
          {loading ? (
            <div className="page-loader">
              <div className="spinner" />
            </div>
          ) : customers.length === 0 ? (
            <div className="state-message">
              <span className="state-message-icon">👥</span>
              <h3>No customers yet</h3>
              <p>
                {search || statusFilter
                  ? 'No customers match your current search or filter.'
                  : 'Customers will appear here when they register and start projects.'}
              </p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        checked={
                          selectedCount === customers.length && customers.length > 0
                        }
                        onChange={selectAll}
                        aria-label="Select all customers"
                      />
                    </th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Projects</th>
                    <th>Registered</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr
                      key={c.id}
                      className={selected.has(c.id) ? 'selected-row' : undefined}
                    >
                      {/* checkbox */}
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.has(c.id)}
                          onChange={() => toggleSelected(c.id)}
                          aria-label={`Select ${c.name}`}
                        />
                      </td>

                      {/* name — clickable to navigate */}
                      <td>
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          style={{
                            fontWeight: 600,
                            fontSize: 'var(--font-size-sm)',
                            justifyContent: 'flex-start',
                            padding: 0,
                            color: 'var(--color-primary)',
                            textDecoration: 'none',
                          }}
                          onClick={() =>
                            navigate(`/admin/projects?customerId=${c.id}`)
                          }
                          title={`View projects for ${c.name}`}
                        >
                          {c.name}
                        </button>
                      </td>

                      {/* email */}
                      <td>{c.email}</td>

                      {/* project count badge */}
                      <td>
                        <span
                          className={`badge ${c.projectCount > 0 ? 'badge--live' : 'badge--neutral'}`}
                        >
                          {c.projectCount}
                        </span>
                      </td>

                      {/* registered date */}
                      <td>
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>

                      {/* status badge */}
                      <td>
                        <span
                          className={`badge ${c.isActive ? 'badge--published' : 'badge--unpublished'}`}
                        >
                          {c.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* actions — inline, NO popups */}
                      <td>
                        {deletingId === c.id ? (
                          /* ── inline delete confirmation (inside the row cell) ── */
                          <div className="form-inline" style={{ gap: 'var(--space-1)' }}>
                            <span
                              style={{
                                fontSize: 'var(--font-size-xs)',
                                color: 'var(--content-muted)',
                              }}
                            >
                              Delete {c.name}?
                            </span>
                            <button
                              type="button"
                              className="btn btn--danger btn--sm"
                              disabled={deleteSaving}
                              onClick={() => void handleDeleteRow(c.id)}
                            >
                              {deleteSaving ? '…' : 'Confirm'}
                            </button>
                            <button
                              type="button"
                              className="btn btn--outline btn--sm"
                              disabled={deleteSaving}
                              onClick={() => setDeletingId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="form-inline">
                            <button
                              type="button"
                              className="btn btn--ghost btn--sm"
                              onClick={() => openView(c)}
                            >
                              View
                            </button>
                            <button
                              type="button"
                              className="btn btn--outline btn--sm"
                              onClick={() => openEdit(c)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className={`btn btn--sm ${c.isActive ? 'btn--outline' : 'btn--outline'}`}
                              onClick={() =>
                                handleSetStatus(c.id, !c.isActive)
                              }
                            >
                              {c.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              type="button"
                              className="btn btn--ghost btn--sm"
                              style={{ color: 'var(--color-danger)' }}
                              onClick={() => {
                                setDeletingId(c.id);
                                setViewingCustomer(null);
                                setEditingCustomer(null);
                                setShowAddPanel(false);
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── pagination ── */}
        {totalPages > 1 && (
          <div
            className="card-header"
            style={{ justifyContent: 'center' }}
          >
            <div className="form-inline">
              <button
                className="btn btn--outline btn--sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <span
                style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--content-muted)',
                }}
              >
                Page {page} of {totalPages}
              </span>
              <button
                className="btn btn--outline btn--sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
