import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { customerProjects as cpApi } from '../api/client';
import { useToast } from '../components/useToast';
import type { Customer } from '../types';

type EditingPanel =
  | { mode: 'create-customer' }
  | { mode: 'create-project'; customer: Customer }
  | null;

export default function Customers() {
  const { addToast, ToastContainer } = useToast();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<{ ids: string[]; isActive: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingPanel, setEditingPanel] = useState<EditingPanel>(null);
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '' });
  const [projectForm, setProjectForm] = useState({ title: '', goal: '', requirements: '', timeline: '' });

  const fetchCustomers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await cpApi.listCustomers({ page, pageSize: 20 });
      setCustomers(res.data as Customer[]);
      setTotalPages(res.pagination?.totalPages ?? 1);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCustomers(); }, [page]);

  const toggleSelected = (id: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const selectAll = () => setSelected((current) => current.size === customers.length ? new Set() : new Set(customers.map((customer) => customer.id)));

  const updateStatus = async () => {
    if (!confirm) return;
    setSaving(true);
    try {
      await Promise.all(confirm.ids.map((id) => cpApi.setStatus(id, confirm.isActive)));
      addToast(confirm.isActive ? 'Customer accounts activated' : 'Customer accounts deactivated', 'success');
      setConfirm(null);
      await fetchCustomers();
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Failed to update customer status', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openCreateCustomer = () => {
    setEditingPanel({ mode: 'create-customer' });
    setCreateForm({ name: '', email: '', password: '' });
  };

  const openCreateProject = (customer: Customer) => {
    setEditingPanel({ mode: 'create-project', customer });
    setProjectForm({ title: '', goal: '', requirements: '', timeline: '' });
  };

  const closePanel = () => setEditingPanel(null);

  const createCustomer = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await cpApi.createCustomer(createForm);
      addToast('Customer account created', 'success');
      setEditingPanel(null);
      setCreateForm({ name: '', email: '', password: '' });
      await fetchCustomers();
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Failed to create customer', 'error');
    } finally {
      setSaving(false);
    }
  };

  const createProject = async (event: FormEvent) => {
    event.preventDefault();
    if (editingPanel?.mode !== 'create-project') return;
    setSaving(true);
    try {
      await cpApi.create({ customerId: editingPanel.customer.id, ...projectForm });
      addToast('Customer project created', 'success');
      setEditingPanel(null);
      setProjectForm({ title: '', goal: '', requirements: '', timeline: '' });
      await fetchCustomers();
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Failed to create project', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <ToastContainer />
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">Registered customers and their active projects.</p>
        </div>
        <div className="form-inline">
          <button className="btn btn--primary" onClick={openCreateCustomer}>Add Customer</button>
          <button className="btn btn--primary" disabled={selected.size === 0} onClick={() => setConfirm({ ids: [...selected], isActive: true })}>Activate selected</button>
          <button className="btn btn--outline" disabled={selected.size === 0} onClick={() => setConfirm({ ids: [...selected], isActive: false })}>Deactivate selected</button>
        </div>
      </div>

      {error && <div className="alert alert--error" role="alert">{error}</div>}

      {confirm && (
        <div className="inline-confirm-bar" role="region" aria-label="Confirm status change">
          <span>
            {confirm.isActive
              ? `Activate ${confirm.ids.length} customer account(s)? They will be able to sign in again.`
              : `Deactivate ${confirm.ids.length} customer account(s)? They will be blocked from signing in.`}
          </span>
          <div className="form-inline">
            <button type="button" className="btn btn--primary btn--sm" disabled={saving} onClick={() => void updateStatus()}>
              {saving ? '...' : confirm.isActive ? 'Activate' : 'Deactivate'}
            </button>
            <button type="button" className="btn btn--outline btn--sm" disabled={saving} onClick={() => setConfirm(null)}>Cancel</button>
          </div>
        </div>
      )}

      {editingPanel?.mode === 'create-customer' && (
        <div className="card inline-edit-panel" role="region" aria-label="Add customer">
          <form onSubmit={createCustomer}>
            <div className="inline-edit-panel-title">
              <h2 className="page-title">Add Customer</h2>
            </div>
            <div className="form-group"><label className="form-label">Name *</label><input className="form-input" required maxLength={100} value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Email *</label><input className="form-input" required type="email" maxLength={200} value={createForm.email} onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Temporary password *</label><input className="form-input" required type="password" minLength={8} value={createForm.password} onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))} autoComplete="new-password" /></div>
            <div className="form-actions"><button type="button" className="btn btn--outline" onClick={closePanel}>Cancel</button><button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Creating...' : 'Create customer'}</button></div>
          </form>
        </div>
      )}

      {editingPanel?.mode === 'create-project' && (
        <div className="card inline-edit-panel" role="region" aria-label={`Add project for ${editingPanel.customer.name}`}>
          <form onSubmit={createProject}>
            <div className="inline-edit-panel-title">
              <h2 className="page-title">Add project for {editingPanel.customer.name}</h2>
            </div>
            <div className="form-group"><label className="form-label">Title *</label><input className="form-input" required maxLength={200} value={projectForm.title} onChange={(event) => setProjectForm((current) => ({ ...current, title: event.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Goal</label><textarea className="form-textarea" maxLength={5000} value={projectForm.goal} onChange={(event) => setProjectForm((current) => ({ ...current, goal: event.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Requirements</label><textarea className="form-textarea" maxLength={10000} value={projectForm.requirements} onChange={(event) => setProjectForm((current) => ({ ...current, requirements: event.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Timeline</label><input className="form-input" maxLength={500} value={projectForm.timeline} onChange={(event) => setProjectForm((current) => ({ ...current, timeline: event.target.value }))} /></div>
            <div className="form-actions"><button type="button" className="btn btn--outline" onClick={closePanel}>Cancel</button><button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Creating...' : 'Create project'}</button></div>
          </form>
        </div>
      )}

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
              <p>Customers will appear here when they register and start projects.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th><input type="checkbox" checked={selected.size === customers.length && customers.length > 0} onChange={selectAll} aria-label="Select all customers" /></th>
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
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/admin/projects?customerId=${c.id}`)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/admin/projects?customerId=${c.id}`); } }}
                      tabIndex={0}
                      role="link"
                      aria-label={`View projects for ${c.name}`}
                    >
                      <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelected(c.id)} aria-label={`Select ${c.name}`} /></td>
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td>{c.email}</td>
                      <td>
                        <span className={`badge ${c.projectCount > 0 ? 'badge--live' : 'badge--neutral'}`}>
                          {c.projectCount}
                        </span>
                      </td>
                      <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                      <td><span className={`badge ${c.isActive ? 'badge--published' : 'badge--unpublished'}`}>{c.isActive ? 'Active' : 'Inactive'}</span></td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button className="btn btn--outline btn--sm" onClick={() => openCreateProject(c)}>Add project</button>
                      </td>
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
    </div>
  );
}
