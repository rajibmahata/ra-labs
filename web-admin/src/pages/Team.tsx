import { useMemo, useState, useEffect, useRef, type FormEvent } from 'react';
import { team as teamApi, github as githubApi, ApiClientError, getStoredUser } from '../api/client';
import { InlineConfirm } from '../components/InlineConfirm';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Pagination } from '../components/Pagination';
import { SortableTh, type SortDirection } from '../components/SortableTh';
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

type EditingPanel =
  | { mode: 'create' }
  | { mode: 'edit'; member: TeamMember }
  | null;

export default function Team() {
  const { addToast, ToastContainer } = useToast();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingPanel, setEditingPanel] = useState<EditingPanel>(null);
  const [form, setForm] = useState<TeamMemberForm>({ ...emptyForm });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statusConfirm, setStatusConfirm] = useState<{ ids: string[]; isActive: boolean } | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [sortKey, setSortKey] = useState('');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const isSuperAdmin = getStoredUser<{ role?: string }>()?.role === 'super_admin';

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const visibleMembers = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    const filtered = q
      ? members.filter((m) => [m.name, m.role, m.githubUsername ?? '', m.email ?? '', m.location ?? ''].some((v) => v.toLowerCase().includes(q)))
      : members;
    const sorted = [...filtered];
    if (sortKey) {
      const dir = sortDirection === 'asc' ? 1 : -1;
      sorted.sort((a, b) => {
        const av = (a as unknown as Record<string, string>)[sortKey] ?? '';
        const bv = (b as unknown as Record<string, string>)[sortKey] ?? '';
        return String(av).localeCompare(String(bv)) * dir;
      });
    }
    return sorted.slice((page - 1) * pageSize, page * pageSize);
  }, [members, searchFilter, sortKey, sortDirection, page]);

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

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = async (file: File) => {
    try {
      const res = await teamApi.importCsv(file);
      const summary = res.data;
      addToast(`Import: ${summary.created} created, ${summary.skipped} skipped${summary.errors.length ? `, ${summary.errors.length} errors` : ''}`, summary.errors.length ? 'error' : 'success');
      fetchMembers();
    } catch (e) {
      addToast(e instanceof ApiClientError ? e.message : 'Failed to import CSV', 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExport = async () => {
    try {
      const blob = await teamApi.exportCsv();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'team.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      addToast(e instanceof ApiClientError ? e.message : 'Failed to export CSV', 'error');
    }
  };

  const openCreate = () => {
    setEditingPanel({ mode: 'create' });
    setForm({ ...emptyForm });
    setFieldErrors({});
  };

  const openEdit = (m: TeamMember) => {
    setEditingPanel({ mode: 'edit', member: m });
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
  };

  const closePanel = () => {
    setEditingPanel(null);
    setFieldErrors({});
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

      const isEdit = editingPanel?.mode === 'edit';
      if (isEdit) {
        await teamApi.update(editingPanel.member.id, payload);
        addToast('Team member updated', 'success');
      } else {
        await teamApi.create(payload);
        addToast('Team member created', 'success');
      }
      closePanel();
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

  const handleDelete = async (id: string) => {
    try {
      await teamApi.delete(id);
      addToast('Team member removed (unpublished)', 'success');
      fetchMembers();
    } catch (e) {
      addToast(e instanceof ApiClientError ? e.message : 'Failed to delete team member', 'error');
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
    try {
      await Promise.all(statusConfirm.ids.map((id) => teamApi.setStatus(id, statusConfirm.isActive)));
      addToast(statusConfirm.isActive ? 'Team members activated and left unpublished' : 'Team members deactivated', 'success');
      setStatusConfirm(null);
      await fetchMembers();
    } catch (e) {
      addToast(e instanceof ApiClientError ? e.message : 'Failed to update team member status', 'error');
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

  async function handleStatusForMember(id: string, isActive: boolean) {
    try {
      await teamApi.setStatus(id, isActive);
      addToast(isActive ? 'Team member activated and left unpublished' : 'Team member deactivated', 'success');
      await fetchMembers();
    } catch (e) {
      addToast(e instanceof ApiClientError ? e.message : 'Failed to update team member status', 'error');
    }
  }

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
          <button className="btn btn--outline" onClick={handleExport}>Export CSV</button>
          <button className="btn btn--outline" onClick={() => fileInputRef.current?.click()}>Import CSV</button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            aria-label="Import team CSV"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImport(f); }}
          />
          {isSuperAdmin && <>
            <button className="btn btn--outline" disabled={selected.size === 0} onClick={() => setStatusConfirm({ ids: [...selected], isActive: true })}>Activate selected</button>
            <button className="btn btn--outline" disabled={selected.size === 0} onClick={() => setStatusConfirm({ ids: [...selected], isActive: false })}>Deactivate selected</button>
          </>}
          <button className="btn btn--primary" onClick={openCreate}>Add Member</button>
        </div>
      </div>

      <ConfirmDialog
        open={!!statusConfirm}
        title={
          statusConfirm?.isActive
            ? `Activate ${statusConfirm?.ids.length ?? 0} team member(s)?`
            : `Deactivate ${statusConfirm?.ids.length ?? 0} team member(s)?`
        }
        description={statusConfirm?.isActive ? 'Public profiles will remain hidden until explicitly published.' : 'Their public profiles will be hidden from the public site.'}
        confirmLabel={statusConfirm?.isActive ? 'Activate' : 'Deactivate'}
        cancelLabel="Cancel"
        danger={!statusConfirm?.isActive}
        onConfirm={async () => { await handleStatus(); }}
        onCancel={() => setStatusConfirm(null)}
      />

      {error && <div className="alert alert--error" role="alert">{error}</div>}

      <div className="filter-bar">
        <input
          className="form-input"
          style={{ minWidth: '220px' }}
          value={searchFilter}
          placeholder="Search name, role, GitHub..."
          aria-label="Search team members"
          onChange={(e) => { setSearchFilter(e.target.value); setPage(1); }}
        />
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--content-muted)', marginLeft: 'auto' }}>
          {members.length} member{members.length !== 1 ? 's' : ''}
        </span>
      </div>

      {editingPanel && (
        <div className="card inline-edit-panel" role="region" aria-label={editingPanel.mode === 'create' ? 'Add team member' : 'Edit team member'}>
          <form onSubmit={handleSubmit} noValidate>
            <div className="inline-edit-panel-title">
              <h2 className="page-title">{editingPanel.mode === 'create' ? 'Add Team Member' : 'Edit Team Member'}</h2>
            </div>
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
              <input className="form-input" type="password" value={form.githubToken} onChange={(e) => setForm((p) => ({ ...p, githubToken: e.target.value }))} placeholder={editingPanel.mode === 'edit' ? 'Leave blank to keep the saved token' : 'Token used by the repository sync agent'} autoComplete="new-password" />
              {editingPanel.mode === 'edit' && <div className="form-hint">{editingPanel.member.hasGithubToken ? 'A token is saved securely.' : 'No token saved yet.'}</div>}
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
              <button type="button" className="btn btn--outline" onClick={closePanel}>Cancel</button>
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? 'Saving...' : (editingPanel.mode === 'edit' ? 'Update' : 'Create')}
              </button>
            </div>
          </form>
        </div>
      )}

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
                    <SortableTh label="Name" sortKey="name" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
                    <SortableTh label="Role" sortKey="role" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
                    <SortableTh label="GitHub" sortKey="githubUsername" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
                    <th>GitHub Commits (90d)</th>
                    <SortableTh label="Published" sortKey="isPublished" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
                    <SortableTh label="Active" sortKey="isActive" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleMembers.map((m) => (
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
                          {isSuperAdmin && (
                            <InlineConfirm
                              onConfirm={() => handleStatusForMember(m.id, !m.isActive)}
                              buttonLabel={m.isActive ? 'Deactivate' : 'Activate'}
                              confirmLabel={m.isActive ? 'Deactivate' : 'Activate'}
                              className="btn btn--outline btn--sm"
                            />
                          )}
                          <InlineConfirm
                            onConfirm={() => handleDelete(m.id)}
                            buttonLabel="Delete"
                            className="btn btn--ghost btn--sm"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {members.length > pageSize && (
          <Pagination page={page} pageSize={pageSize} totalCount={members.length} onPageChange={setPage} />
        )}
      </div>
    </div>
  );
}
