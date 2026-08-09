import { useState, useEffect, type FormEvent } from 'react';
import { team as teamApi, github as githubApi, ApiClientError, getStoredUser } from '../api/client';
import { Modal, ConfirmDialog } from '../components/Modal';
import { useToast } from '../components/useToast';
import type { TeamMember, TeamMemberForm } from '../types';

const emptyForm: TeamMemberForm = {
  name: '',
  role: '',
  bio: '',
  githubUsername: '',
  githubAccountUrl: '',
  githubToken: '',
  avatarUrl: '',
  email: '',
  linkedinUrl: '',
  location: '',
  isPublished: false,
};

export default function Team() {
  const { addToast, ToastContainer } = useToast();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TeamMemberForm>({ ...emptyForm });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TeamMember | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statusConfirm, setStatusConfirm] = useState<{ ids: string[]; isActive: boolean } | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const isSuperAdmin = getStoredUser<{ role?: string }>()?.role === 'super_admin';

  const fetchMembers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await teamApi.list();
      setMembers(res.data as TeamMember[]);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMembers(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setFieldErrors({});
    setModalOpen(true);
  };

  const openEdit = (m: TeamMember) => {
    setEditingId(m.id);
    setForm({
      name: m.name,
      role: m.role,
      bio: m.bio,
      githubUsername: m.githubUsername ?? '',
      githubAccountUrl: m.githubAccountUrl ?? '',
      githubToken: '',
      avatarUrl: m.avatarUrl ?? '',
      email: m.email ?? '',
      linkedinUrl: m.linkedinUrl ?? '',
      location: m.location ?? '',
      isPublished: m.isPublished,
    });
    setFieldErrors({});
    setModalOpen(true);
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    else if (form.name.length > 100) errs.name = 'Name must be 100 characters or fewer';
    if (!form.role.trim()) errs.role = 'Role is required';
    else if (form.role.length > 100) errs.role = 'Role must be 100 characters or fewer';
    if (!form.bio.trim()) errs.bio = 'Bio is required';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        role: form.role.trim(),
        bio: form.bio.trim(),
        githubUsername: form.githubUsername || null,
        githubAccountUrl: form.githubAccountUrl || null,
        ...(form.githubToken ? { githubToken: form.githubToken } : {}),
        avatarUrl: form.avatarUrl || null,
        email: form.email || null,
        linkedinUrl: form.linkedinUrl || null,
        location: form.location || null,
        isPublished: form.isPublished,
      };

      if (editingId) {
        await teamApi.update(editingId, payload);
        addToast('Team member updated', 'success');
      } else {
        await teamApi.create(payload);
        addToast('Team member created', 'success');
      }
      setModalOpen(false);
      fetchMembers();
    } catch (e) {
      if (e instanceof ApiClientError) {
        addToast(e.message, 'error');
        if (e.code === 'CONFLICT') {
          setFieldErrors((prev) => ({ ...prev, slug: 'A member with this slug already exists' }));
        }
      } else {
        addToast('Failed to save team member', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await teamApi.delete(deleteTarget.id);
      addToast('Team member removed (unpublished)', 'success');
      setDeleteTarget(null);
      fetchMembers();
    } catch (e) {
      addToast(e instanceof ApiClientError ? e.message : 'Failed to delete team member', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelected = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((current) => current.size === members.length ? new Set() : new Set(members.map((member) => member.id)));
  };

  const handleStatus = async () => {
    if (!statusConfirm) return;
    setUpdatingStatus(true);
    try {
      await Promise.all(statusConfirm.ids.map((id) => teamApi.setStatus(id, statusConfirm.isActive)));
      addToast(statusConfirm.isActive ? 'Team members activated and left unpublished' : 'Team members deactivated', 'success');
      setStatusConfirm(null);
      await fetchMembers();
    } catch (e) {
      addToast(e instanceof ApiClientError ? e.message : 'Failed to update team member status', 'error');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await githubApi.sync();
      addToast(result.data.error ?? 'GitHub repositories synced. They are now available in Work.', result.data.status === 'failed' ? 'error' : 'success');
      await fetchMembers();
    } catch (e) {
      addToast(e instanceof ApiClientError ? e.message : 'GitHub sync failed', 'error');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <ToastContainer />
      <div className="page-header">
        <div>
          <h1 className="page-title">Team</h1>
          <p className="page-subtitle">Manage team member profiles shown on the public site.</p>
        </div>
        <div className="form-inline">
          <button className="btn btn--outline" onClick={() => void handleSync()} disabled={syncing}>{syncing ? 'Syncing...' : 'Sync GitHub'}</button>
          {isSuperAdmin && <>
            <button className="btn btn--outline" disabled={selected.size === 0} onClick={() => setStatusConfirm({ ids: [...selected], isActive: true })}>Activate selected</button>
            <button className="btn btn--outline" disabled={selected.size === 0} onClick={() => setStatusConfirm({ ids: [...selected], isActive: false })}>Deactivate selected</button>
          </>}
          <button className="btn btn--primary" onClick={openCreate}>Add Member</button>
        </div>
      </div>

      {error && <div className="alert alert--error" role="alert">{error}</div>}

      <div className="card">
        <div className="card-body card-body--flush">
          {loading ? (
            <div className="page-loader"><div className="spinner" /></div>
          ) : members.length === 0 ? (
            <div className="state-message">
              <span className="state-message-icon">👥</span>
              <h3>No team members yet</h3>
              <p>Add team members to display on the public site.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    {isSuperAdmin && <th><input type="checkbox" checked={members.length > 0 && selected.size === members.length} onChange={toggleAll} aria-label="Select all team members" /></th>}
                    <th>Name</th>
                    <th>Role</th>
                    <th>GitHub</th>
                    <th>GitHub Commits (90d)</th>
                    <th>Published</th>
                    <th>Active</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id}>
                      {isSuperAdmin && <td><input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleSelected(m.id)} aria-label={`Select ${m.name}`} /></td>}
                      <td style={{ fontWeight: 600 }}>{m.name}</td>
                      <td>{m.role}</td>
                      <td>{m.githubUsername ?? '—'}</td>
                      <td>{m.githubSnapshot ? `${m.githubSnapshot.commits90d} commits` : '—'}</td>
                      <td>
                        <span className={`badge ${m.isPublished ? 'badge--published' : 'badge--unpublished'}`}>
                          {m.isPublished ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <td><span className={`badge ${m.isActive ? 'badge--published' : 'badge--unpublished'}`}>{m.isActive ? 'Active' : 'Inactive'}</span></td>
                      <td>
                        <div className="form-inline">
                          <button className="btn btn--outline btn--sm" onClick={() => openEdit(m)}>Edit</button>
                          {isSuperAdmin && <button className="btn btn--outline btn--sm" onClick={() => setStatusConfirm({ ids: [m.id], isActive: !m.isActive })}>{m.isActive ? 'Deactivate' : 'Activate'}</button>}
                          <button className="btn btn--ghost btn--sm" style={{ color: '#dc2626' }} onClick={() => setDeleteTarget(m)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Team Member' : 'Add Team Member'} width="600px">
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className={`form-input${fieldErrors.name ? ' form-input--error' : ''}`} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} maxLength={100} />
              {fieldErrors.name && <div className="form-error">{fieldErrors.name}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Role *</label>
              <input className={`form-input${fieldErrors.role ? ' form-input--error' : ''}`} value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))} maxLength={100} />
              {fieldErrors.role && <div className="form-error">{fieldErrors.role}</div>}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Bio *</label>
            <textarea className={`form-textarea${fieldErrors.bio ? ' form-textarea--error' : ''}`} value={form.bio} onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))} rows={3} />
            {fieldErrors.bio && <div className="form-error">{fieldErrors.bio}</div>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">GitHub Username</label>
              <input className="form-input" value={form.githubUsername} onChange={(e) => setForm((p) => ({ ...p, githubUsername: e.target.value }))} placeholder="rajibmahata" maxLength={100} />
            </div>
            <div className="form-group">
              <label className="form-label">GitHub Account URL</label>
              <input className="form-input" type="url" value={form.githubAccountUrl} onChange={(e) => setForm((p) => ({ ...p, githubAccountUrl: e.target.value }))} placeholder="https://github.com/username" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">GitHub Personal Access Token</label>
            <input className="form-input" type="password" value={form.githubToken} onChange={(e) => setForm((p) => ({ ...p, githubToken: e.target.value }))} placeholder={editingId ? 'Leave blank to keep the saved token' : 'Token used by the repository sync agent'} autoComplete="new-password" />
            {editingId && <div className="form-hint">{members.find((member) => member.id === editingId)?.hasGithubToken ? 'A token is saved securely.' : 'No token saved yet.'}</div>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="name@ralabs.com" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">LinkedIn URL</label>
              <input className="form-input" value={form.linkedinUrl} onChange={(e) => setForm((p) => ({ ...p, linkedinUrl: e.target.value }))} placeholder="https://linkedin.com/in/..." />
            </div>
            <div className="form-group">
              <label className="form-label">Location</label>
              <input className="form-input" value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Avatar URL</label>
            <input className="form-input" value={form.avatarUrl} onChange={(e) => setForm((p) => ({ ...p, avatarUrl: e.target.value }))} placeholder="https://cdn.example.com/team/photo.jpg" maxLength={500} />
          </div>
          <div className="form-group" style={{ paddingTop: '8px' }}>
            <label className="form-checkbox">
              <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm((p) => ({ ...p, isPublished: e.target.checked }))} />
              Published on public site
            </label>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn--outline" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving...' : (editingId ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Remove Team Member"
        message={`Remove "${deleteTarget?.name}" from the team? This will unpublish their profile from the public site.`}
        confirmLabel="Remove"
        loading={deleting}
      />
      <ConfirmDialog
        open={!!statusConfirm}
        onClose={() => setStatusConfirm(null)}
        onConfirm={handleStatus}
        title={statusConfirm?.isActive ? 'Activate Team Members' : 'Deactivate Team Members'}
        message={statusConfirm?.isActive
          ? `Activate ${statusConfirm.ids.length} team member${statusConfirm.ids.length === 1 ? '' : 's'}? Their public profiles will remain hidden until explicitly published.`
          : `Deactivate ${statusConfirm?.ids.length ?? 0} team member${statusConfirm?.ids.length === 1 ? '' : 's'}? Their public profiles will be hidden.`}
        confirmLabel={statusConfirm?.isActive ? 'Activate' : 'Deactivate'}
        loading={updatingStatus}
      />
    </div>
  );
}
