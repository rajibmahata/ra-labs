import { useState, useEffect, type FormEvent } from 'react';
import { projects as projectsApi, ApiClientError } from '../api/client';
import { Modal, ConfirmDialog } from '../components/Modal';
import { useToast } from '../components/useToast';
import type { Project, ProjectForm } from '../types';

const emptyForm: ProjectForm = {
  title: '',
  slug: '',
  summary: '',
  stackTags: [],
  status: 'in_build',
  githubUrl: '',
  caseStudyBody: '',
  coverImageUrl: '',
  sortOrder: 0,
  isPublished: false,
};

export default function Portfolio() {
  const { addToast, ToastContainer } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProjectForm>({ ...emptyForm });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<{ ids: string[]; kind: 'publish' | 'unpublish' | 'delete' } | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);

  const fetchProjects = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await projectsApi.list();
      setProjects(res.data as Project[]);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProjects(); }, []);

  const generateSlug = (title: string) =>
    title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setFieldErrors({});
    setModalOpen(true);
  };

  const openEdit = (p: Project) => {
    setEditingId(p.id);
    setForm({
      title: p.title,
      slug: '',
      summary: p.summary,
      stackTags: p.stackTags,
      status: p.status,
      githubUrl: p.githubUrl ?? '',
      caseStudyBody: p.caseStudyBody ?? '',
      coverImageUrl: p.coverImageUrl ?? '',
      sortOrder: p.sortOrder,
      isPublished: p.isPublished,
    });
    setFieldErrors({});
    setModalOpen(true);
  };

  const handleTitleChange = (title: string) => {
    setForm((prev) => ({ ...prev, title, slug: editingId ? prev.slug : generateSlug(title) }));
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = 'Title is required';
    else if (form.title.length > 200) errs.title = 'Title must be 200 characters or fewer';
    if (!form.summary.trim()) errs.summary = 'Summary is required';
    else if (form.summary.length > 500) errs.summary = 'Summary must be 500 characters or fewer';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        summary: form.summary.trim(),
        stackTags: form.stackTags,
        status: form.status,
        githubUrl: form.githubUrl || null,
        caseStudyBody: form.caseStudyBody || null,
        coverImageUrl: form.coverImageUrl || null,
        sortOrder: form.sortOrder,
        isPublished: form.isPublished,
      };
      if (form.slug && !editingId) payload.slug = form.slug;

      if (editingId) {
        await projectsApi.update(editingId, payload);
        addToast('Project updated', 'success');
      } else {
        await projectsApi.create(payload);
        addToast('Project created', 'success');
      }
      setModalOpen(false);
      fetchProjects();
    } catch (e) {
      if (e instanceof ApiClientError) {
        addToast(e.message, 'error');
        if (e.code === 'CONFLICT') {
          setFieldErrors((prev) => ({ ...prev, slug: 'This slug is already taken' }));
        }
      } else {
        addToast('Failed to save project', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await projectsApi.delete(deleteTarget.id);
      addToast('Project deleted', 'success');
      setDeleteTarget(null);
      fetchProjects();
    } catch (e) {
      addToast(e instanceof ApiClientError ? e.message : 'Failed to delete project', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkAction = async () => {
    if (!bulkAction) return;
    setBulkSaving(true);
    try {
      if (bulkAction.kind === 'delete') await Promise.all(bulkAction.ids.map((id) => projectsApi.delete(id)));
      else await Promise.all(bulkAction.ids.map((id) => projectsApi.setPublished(id, bulkAction.kind === 'publish')));
      addToast(bulkAction.kind === 'delete' ? 'Projects deleted' : bulkAction.kind === 'publish' ? 'Projects activated' : 'Projects deactivated', 'success');
      setBulkAction(null);
      await fetchProjects();
    } catch (e) {
      addToast(e instanceof ApiClientError ? e.message : 'Failed to update selected projects', 'error');
    } finally {
      setBulkSaving(false);
    }
  };

  const toggleSelected = (id: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const selectAll = () => setSelected((current) => current.size === projects.length ? new Set() : new Set(projects.map((project) => project.id)));

  return (
    <div>
      <ToastContainer />
      <div className="page-header">
        <div>
          <h1 className="page-title">Portfolio</h1>
          <p className="page-subtitle">Manage public portfolio projects.</p>
        </div>
        <div className="form-inline">
          <button className="btn btn--primary" onClick={openCreate}>Add Project</button>
          <button className="btn btn--outline" disabled={selected.size === 0} onClick={() => setBulkAction({ ids: [...selected], kind: 'publish' })}>Activate selected</button>
          <button className="btn btn--outline" disabled={selected.size === 0} onClick={() => setBulkAction({ ids: [...selected], kind: 'unpublish' })}>Deactivate selected</button>
          <button className="btn btn--ghost" style={{ color: '#dc2626' }} disabled={selected.size === 0} onClick={() => setBulkAction({ ids: [...selected], kind: 'delete' })}>Delete selected</button>
        </div>
      </div>

      {error && <div className="alert alert--error" role="alert">{error}</div>}

      <div className="card">
        <div className="card-body card-body--flush">
          {loading ? (
            <div className="page-loader"><div className="spinner" /></div>
          ) : projects.length === 0 ? (
            <div className="state-message">
              <span className="state-message-icon">💼</span>
              <h3>No projects yet</h3>
              <p>Create your first portfolio project to showcase your work.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th><input type="checkbox" checked={selected.size === projects.length && projects.length > 0} onChange={selectAll} aria-label="Select all projects" /></th>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Tags</th>
                    <th>Published</th>
                    <th>Order</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => (
                    <tr key={p.id}>
                      <td><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelected(p.id)} aria-label={`Select ${p.title}`} /></td>
                      <td style={{ fontWeight: 600 }}>{p.title}</td>
                      <td><span className={`badge badge--${p.status}`}>{p.status}</span></td>
                      <td>
                        {p.stackTags.map((t) => (
                          <span key={t} className="badge badge--neutral" style={{ marginRight: 4 }}>{t}</span>
                        ))}
                      </td>
                      <td><span className={`badge ${p.isPublished ? 'badge--published' : 'badge--unpublished'}`}>{p.isPublished ? 'Yes' : 'No'}</span></td>
                      <td>{p.sortOrder}</td>
                      <td>{new Date(p.createdAt).toLocaleDateString()}</td>
                      <td>
                        <div className="form-inline">
                          <button className="btn btn--outline btn--sm" onClick={() => openEdit(p)}>Edit</button>
                          <button className="btn btn--ghost btn--sm" style={{ color: '#dc2626' }} onClick={() => setDeleteTarget(p)}>Delete</button>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Project' : 'Create Project'}>
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label">Title *</label>
            <input className={`form-input${fieldErrors.title ? ' form-input--error' : ''}`} value={form.title} onChange={(e) => handleTitleChange(e.target.value)} maxLength={200} />
            {fieldErrors.title && <div className="form-error">{fieldErrors.title}</div>}
          </div>
          {!editingId && (
            <div className="form-group">
              <label className="form-label">Slug</label>
              <input className="form-input" value={form.slug} onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))} placeholder="auto-generated if blank" maxLength={100} />
              {fieldErrors.slug && <div className="form-error">{fieldErrors.slug}</div>}
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Summary *</label>
            <textarea className={`form-textarea${fieldErrors.summary ? ' form-textarea--error' : ''}`} value={form.summary} onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))} maxLength={500} rows={3} />
            {fieldErrors.summary && <div className="form-error">{fieldErrors.summary}</div>}
          </div>
          <div className="form-group">
            <label className="form-label">Stack Tags (comma-separated)</label>
            <input className="form-input" value={form.stackTags.join(', ')} onChange={(e) => setForm((p) => ({ ...p, stackTags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))} placeholder="dotnet, react, qdrant" />
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as 'live' | 'in_build' }))}>
              <option value="live">Live</option>
              <option value="in_build">In Build</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">GitHub URL</label>
            <input className="form-input" value={form.githubUrl} onChange={(e) => setForm((p) => ({ ...p, githubUrl: e.target.value }))} placeholder="https://github.com/..." maxLength={500} />
          </div>
          <div className="form-group">
            <label className="form-label">Cover Image URL</label>
            <input className="form-input" value={form.coverImageUrl} onChange={(e) => setForm((p) => ({ ...p, coverImageUrl: e.target.value }))} placeholder="https://cdn.example.com/..." maxLength={500} />
          </div>
          <div className="form-group">
            <label className="form-label">Case Study Body (Markdown)</label>
            <textarea className="form-textarea" value={form.caseStudyBody} onChange={(e) => setForm((p) => ({ ...p, caseStudyBody: e.target.value }))} rows={5} />
          </div>
          <div className="form-group" style={{ display: 'flex', gap: '24px' }}>
            <div style={{ flex: 1 }}>
              <label className="form-label">Sort Order</label>
              <input className="form-input" type="number" value={form.sortOrder} onChange={(e) => setForm((p) => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))} />
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', paddingTop: '24px' }}>
              <label className="form-checkbox">
                <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm((p) => ({ ...p, isPublished: e.target.checked }))} />
                Published
              </label>
            </div>
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
        title="Delete Project"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This will soft-delete the project (unpublishes it).`}
        confirmLabel="Delete"
        loading={deleting}
      />
      <ConfirmDialog
        open={bulkAction !== null}
        onClose={() => setBulkAction(null)}
        onConfirm={() => void handleBulkAction()}
        title={bulkAction?.kind === 'delete' ? 'Delete selected projects?' : bulkAction?.kind === 'publish' ? 'Activate selected projects?' : 'Deactivate selected projects?'}
        message={bulkAction?.kind === 'delete' ? 'Selected projects will be soft-deleted and removed from public display.' : bulkAction?.kind === 'publish' ? 'Selected projects will be visible on the public site.' : 'Selected projects will be hidden from the public site.'}
        confirmLabel={bulkAction?.kind === 'delete' ? 'Delete' : bulkAction?.kind === 'publish' ? 'Activate' : 'Deactivate'}
        loading={bulkSaving}
      />
    </div>
  );
}
