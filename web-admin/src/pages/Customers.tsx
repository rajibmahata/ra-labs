import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { customerProjects as cpApi } from '../api/client';
import { ConfirmDialog, Modal } from '../components/Modal';
import { useToast } from '../components/useToast';
import type { Customer } from '../types';

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
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '' });
  const [projectCustomer, setProjectCustomer] = useState<Customer | null>(null);
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

  const createCustomer = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await cpApi.createCustomer(createForm);
      addToast('Customer account created', 'success');
      setCreateOpen(false);
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
    if (!projectCustomer) return;
    setSaving(true);
    try {
      await cpApi.create({ customerId: projectCustomer.id, ...projectForm });
      addToast('Customer project created', 'success');
      setProjectCustomer(null);
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
          <button className="btn btn--primary" onClick={() => setCreateOpen(true)}>Add Customer</button>
          <button className="btn btn--primary" disabled={selected.size === 0} onClick={() => setConfirm({ ids: [...selected], isActive: true })}>Activate selected</button>
          <button className="btn btn--outline" disabled={selected.size === 0} onClick={() => setConfirm({ ids: [...selected], isActive: false })}>Deactivate selected</button>
        </div>
      </div>

      {error && <div className="alert alert--error" role="alert">{error}</div>}

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
                        <button className="btn btn--outline btn--sm" onClick={() => setProjectCustomer(c)}>Add project</button>
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
      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => void updateStatus()}
        title={confirm?.isActive ? 'Activate customer accounts?' : 'Deactivate customer accounts?'}
        message={confirm?.isActive ? 'Selected customers will be able to sign in again.' : 'Selected customers will be blocked from signing in.'}
        confirmLabel={confirm?.isActive ? 'Activate' : 'Deactivate'}
        loading={saving}
      />
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add Customer">
        <form onSubmit={createCustomer}>
          <div className="form-group"><label className="form-label">Name *</label><input className="form-input" required maxLength={100} value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Email *</label><input className="form-input" required type="email" maxLength={200} value={createForm.email} onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Temporary password *</label><input className="form-input" required type="password" minLength={8} value={createForm.password} onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))} autoComplete="new-password" /></div>
          <div className="form-actions"><button type="button" className="btn btn--outline" onClick={() => setCreateOpen(false)}>Cancel</button><button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Creating...' : 'Create customer'}</button></div>
        </form>
      </Modal>
      <Modal open={projectCustomer !== null} onClose={() => setProjectCustomer(null)} title={`Add project for ${projectCustomer?.name ?? 'customer'}`}>
        <form onSubmit={createProject}>
          <div className="form-group"><label className="form-label">Title *</label><input className="form-input" required maxLength={200} value={projectForm.title} onChange={(event) => setProjectForm((current) => ({ ...current, title: event.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Goal</label><textarea className="form-textarea" maxLength={5000} value={projectForm.goal} onChange={(event) => setProjectForm((current) => ({ ...current, goal: event.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Requirements</label><textarea className="form-textarea" maxLength={10000} value={projectForm.requirements} onChange={(event) => setProjectForm((current) => ({ ...current, requirements: event.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Timeline</label><input className="form-input" maxLength={500} value={projectForm.timeline} onChange={(event) => setProjectForm((current) => ({ ...current, timeline: event.target.value }))} /></div>
          <div className="form-actions"><button type="button" className="btn btn--outline" onClick={() => setProjectCustomer(null)}>Cancel</button><button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Creating...' : 'Create project'}</button></div>
        </form>
      </Modal>
    </div>
  );
}
