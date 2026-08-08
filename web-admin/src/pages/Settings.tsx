import { useState, useEffect, type FormEvent } from 'react';
import { admins as adminsApi, team as teamApi, ApiClientError } from '../api/client';
import { Modal } from '../components/Modal';
import { useToast } from '../components/useToast';
import type { AdminEntry, TeamMember } from '../types';

export default function Settings() {
  const { addToast, ToastContainer } = useToast();
  const [admins, setAdmins] = useState<AdminEntry[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', teamMemberId: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [adminsRes, teamRes] = await Promise.all([
        adminsApi.list(),
        teamApi.list(),
      ]);
      setAdmins(adminsRes.data as AdminEntry[]);
      setTeamMembers(teamRes.data as TeamMember[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setForm({ name: '', email: '', password: '', teamMemberId: '' });
    setFieldErrors({});
    setModalOpen(true);
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email address';
    if (!form.password) errs.password = 'Password is required';
    else if (form.password.length < 8) errs.password = 'Password must be at least 8 characters';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await adminsApi.create({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        teamMemberId: form.teamMemberId || null,
      });
      addToast('Admin account created', 'success');
      setModalOpen(false);
      fetchData();
    } catch (e) {
      if (e instanceof ApiClientError) {
        if (e.code === 'CONFLICT') {
          setFieldErrors((prev) => ({ ...prev, email: 'An admin with this email already exists' }));
        } else {
          addToast(e.message, 'error');
        }
      } else {
        addToast('Failed to create admin', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const getTeamMemberName = (id: string | null | undefined): string => {
    if (!id) return '—';
    const member = teamMembers.find((m) => m.id === id);
    return member ? member.name : 'Unknown';
  };

  return (
    <div>
      <ToastContainer />
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage admin accounts and platform configuration.</p>
        </div>
        <button className="btn btn--primary" onClick={openCreate}>Add Admin</button>
      </div>

      {error && <div className="alert alert--error" role="alert">{error}</div>}

      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="card-header">
          <h2 className="card-title">Admin Accounts</h2>
        </div>
        <div className="card-body card-body--flush">
          {loading ? (
            <div className="page-loader"><div className="spinner" /></div>
          ) : admins.length === 0 ? (
            <div className="state-message">
              <span className="state-message-icon">⚙️</span>
              <h3>No admin accounts</h3>
              <p>Create admin accounts to grant access to this dashboard.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Team Member</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((a) => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 600 }}>{a.name}</td>
                      <td>{a.email}</td>
                      <td>{getTeamMemberName(a.teamMemberId)}</td>
                      <td>{a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Admin" width="520px">
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label">Name *</label>
            <input className={`form-input${fieldErrors.name ? ' form-input--error' : ''}`} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} maxLength={100} />
            {fieldErrors.name && <div className="form-error">{fieldErrors.name}</div>}
          </div>
          <div className="form-group">
            <label className="form-label">Email *</label>
            <input className={`form-input${fieldErrors.email ? ' form-input--error' : ''}`} type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} maxLength={200} />
            {fieldErrors.email && <div className="form-error">{fieldErrors.email}</div>}
          </div>
          <div className="form-group">
            <label className="form-label">Password *</label>
            <input className={`form-input${fieldErrors.password ? ' form-input--error' : ''}`} type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} placeholder="Min 8 characters" />
            {fieldErrors.password && <div className="form-error">{fieldErrors.password}</div>}
          </div>
          <div className="form-group">
            <label className="form-label">Link to Team Member (optional)</label>
            <select className="form-select" value={form.teamMemberId} onChange={(e) => setForm((p) => ({ ...p, teamMemberId: e.target.value }))}>
              <option value="">None</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>{m.name} — {m.role}</option>
              ))}
            </select>
            <div className="form-hint">Linking an admin to a team member enables their "My Profile" self-service updates.</div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn--outline" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Creating...' : 'Create Admin'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
