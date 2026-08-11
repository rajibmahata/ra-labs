import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { projects as projectsApi, team as teamApi, drafts as draftsApi, ApiClientError, type Project } from '../api/client';
import { InlineConfirm } from '../components/InlineConfirm';
import { Pagination } from '../components/Pagination';
import { SortableTh, type SortDirection } from '../components/SortableTh';
import { useToast } from '../components/useToast';
import type { ProjectForm } from '../types';

const emptyForm: ProjectForm = {
  title: '',
  slug: '',
  summary: '',
  stackTags: [],
  status: 'in_build',
  githubUrl: '',
  liveSiteUrl: '',
  category: '',
  businessPurpose: '',
  problemSolved: '',
  solution: '',
  keyFeatures: [],
  caseStudyBody: '',
  coverImageUrl: '',
  screenshots: [],
  duration: '',
  teamMemberIds: [],
  completedAt: '',
  customerReference: '',
  showCustomerReference: false,
  sortOrder: 0,
  isFeatured: false,
  isActive: true,
  isPublished: false,
};

type EditingPanel =
  | { mode: 'create' }
  | { mode: 'edit'; project: Project }
  | null;

interface TeamOption { id: string; name: string; role: string; }

type BulkKind = 'publish' | 'unpublish' | 'feature' | 'unfeature' | 'delete';

export default function Portfolio() {
  const { addToast, ToastContainer } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [teamOptions, setTeamOptions] = useState<TeamOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingPanel, setEditingPanel] = useState<EditingPanel>(null);
  const [form, setForm] = useState<ProjectForm>({ ...emptyForm });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<{ ids: string[]; kind: BulkKind } | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [featuredFilter, setFeaturedFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [sortKey, setSortKey] = useState('');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState<Set<string>>(new Set());
  const pageSize = 10;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const visibleProjects = useMemo(() => {
    const sorted = [...projects];
    if (sortKey) {
      const dir = sortDirection === 'asc' ? 1 : -1;
      sorted.sort((a, b) => {
        const av = (a as unknown as Record<string, unknown>)[sortKey];
        const bv = (b as unknown as Record<string, unknown>)[sortKey];
        if (sortKey === 'createdAt' || sortKey === 'sortOrder') return ((Number(av) || 0) - (Number(bv) || 0)) * dir;
        return String(av ?? '').localeCompare(String(bv ?? '')) * dir;
      });
    }
    return sorted;
  }, [projects, sortKey, sortDirection]);

  const fetchProjects = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await projectsApi.list({
        search: searchFilter.trim() || undefined,
        category: categoryFilter || undefined,
        status: statusFilter || undefined,
        featured: featuredFilter === '' ? undefined : featuredFilter === 'true',
        active: activeFilter === '' ? undefined : activeFilter === 'true',
        page,
        pageSize,
      });
      setProjects(res.data);
      setTotalCount(res.pagination.totalCount);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => { if (!cancelled) void fetchProjects(); }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchFilter, categoryFilter, statusFilter, featuredFilter, activeFilter, page]);

  useEffect(() => {
    const loadTeam = async () => {
      try {
        const res = await teamApi.list();
        setTeamOptions(res.data.map((m) => ({ id: m.id, name: m.name, role: m.role })));
      } catch {
        // team options are optional
      }
    };
    void loadTeam();
  }, []);

  const generateSlug = (title: string) =>
    title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const openCreate = () => {
    setEditingPanel({ mode: 'create' });
    setForm({ ...emptyForm });
    setFieldErrors({});
  };

  const openEdit = (p: Project) => {
    setEditingPanel({ mode: 'edit', project: p });
    setForm({
      title: p.title,
      slug: '',
      summary: p.summary,
      stackTags: p.stackTags,
      status: p.status as 'live' | 'in_build',
      githubUrl: p.githubUrl ?? '',
      liveSiteUrl: p.liveSiteUrl ?? '',
      category: p.category ?? '',
      businessPurpose: p.businessPurpose ?? '',
      problemSolved: p.problemSolved ?? '',
      solution: p.solution ?? '',
      keyFeatures: p.keyFeatures ?? [],
      caseStudyBody: p.caseStudyBody ?? '',
      coverImageUrl: p.coverImageUrl ?? '',
      screenshots: p.screenshots ?? [],
      duration: p.duration ?? '',
      teamMemberIds: p.teamMemberIds ?? [],
      completedAt: p.completedAt ? p.completedAt.slice(0, 10) : '',
      customerReference: p.customerReference ?? '',
      showCustomerReference: p.showCustomerReference,
      sortOrder: p.sortOrder,
      isFeatured: p.isFeatured,
      isActive: p.isActive,
      isPublished: p.isPublished,
    });
    setFieldErrors({});
  };

  const closePanel = () => {
    setEditingPanel(null);
    setFieldErrors({});
  };

  const handleTitleChange = (title: string) => {
    setForm((prev) => ({ ...prev, title, slug: editingPanel?.mode === 'edit' ? prev.slug : generateSlug(title) }));
  };

  const toggleTeamMember = (id: string) => {
    setForm((prev) => {
      const next = prev.teamMemberIds.includes(id)
        ? prev.teamMemberIds.filter((t) => t !== id)
        : [...prev.teamMemberIds, id];
      return { ...prev, teamMemberIds: next };
    });
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = 'Title is required';
    else if (form.title.length > 200) errs.title = 'Title must be 200 characters or fewer';
    if (!form.summary.trim()) errs.summary = 'Summary is required';
    else if (form.summary.length > 500) errs.summary = 'Summary must be 500 characters or fewer';
    if (form.liveSiteUrl && !/^https?:\/\//i.test(form.liveSiteUrl.trim())) errs.liveSiteUrl = 'Live site URL must start with http:// or https://';
    if (form.githubUrl && !/^https?:\/\//i.test(form.githubUrl.trim())) errs.githubUrl = 'GitHub URL must start with http:// or https://';
    if (form.coverImageUrl && !/^https?:\/\//i.test(form.coverImageUrl.trim())) errs.coverImageUrl = 'Cover image URL must start with http:// or https://';
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
        githubUrl: form.githubUrl?.trim() || null,
        liveSiteUrl: form.liveSiteUrl?.trim() || null,
        category: form.category?.trim() || null,
        businessPurpose: form.businessPurpose?.trim() || null,
        problemSolved: form.problemSolved?.trim() || null,
        solution: form.solution?.trim() || null,
        keyFeatures: form.keyFeatures,
        caseStudyBody: form.caseStudyBody || null,
        coverImageUrl: form.coverImageUrl?.trim() || null,
        screenshots: form.screenshots,
        duration: form.duration?.trim() || null,
        teamMemberIds: form.teamMemberIds,
        completedAt: form.completedAt ? new Date(form.completedAt).toISOString() : null,
        customerReference: form.customerReference?.trim() || null,
        showCustomerReference: form.showCustomerReference,
        sortOrder: form.sortOrder,
        isFeatured: form.isFeatured,
        isActive: form.isActive,
        isPublished: form.isPublished,
      };
      const isEdit = editingPanel?.mode === 'edit';
      if (form.slug && !isEdit) payload.slug = form.slug;

      if (isEdit) {
        await projectsApi.update(editingPanel.project.id, payload);
        addToast('Project updated', 'success');
      } else {
        await projectsApi.create(payload);
        addToast('Project created', 'success');
      }
      closePanel();
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

  const handleDelete = async (id: string) => {
    try {
      await projectsApi.delete(id);
      addToast('Project deleted', 'success');
      fetchProjects();
    } catch (e) {
      addToast(e instanceof ApiClientError ? e.message : 'Failed to delete project', 'error');
    }
  };

  const handleSetFlag = async (kind: 'featured' | 'active', id: string, value: boolean) => {
    try {
      if (kind === 'featured') await projectsApi.setFeatured(id, value);
      else await projectsApi.setActive(id, value);
      addToast(kind === 'featured' ? (value ? 'Featured' : 'Unfeatured') : value ? 'Activated' : 'Deactivated', 'success');
      fetchProjects();
    } catch (e) {
      addToast(e instanceof ApiClientError ? e.message : 'Failed to update project', 'error');
    }
  };

  const handleAiRefresh = async (id: string) => {
    setRefreshing((current) => new Set(current).add(id));
    try {
      const res = await draftsApi.generateForProject(id);
      addToast(`AI draft "${res.data.title}" generated — review it in Content Drafts`, 'success');
    } catch (e) {
      addToast(e instanceof ApiClientError ? e.message : 'Failed to generate AI draft', 'error');
    } finally {
      setRefreshing((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  };

  const handleBulkAction = async () => {
    if (!bulkAction) return;
    setBulkSaving(true);
    try {
      const ids = bulkAction.ids;
      if (bulkAction.kind === 'delete') await Promise.all(ids.map((id) => projectsApi.delete(id)));
      else if (bulkAction.kind === 'publish') await Promise.all(ids.map((id) => projectsApi.setPublished(id, true)));
      else if (bulkAction.kind === 'unpublish') await Promise.all(ids.map((id) => projectsApi.setPublished(id, false)));
      else if (bulkAction.kind === 'feature') await Promise.all(ids.map((id) => projectsApi.setFeatured(id, true)));
      else if (bulkAction.kind === 'unfeature') await Promise.all(ids.map((id) => projectsApi.setFeatured(id, false)));
      addToast(`Updated ${ids.length} project(s)`, 'success');
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

  const handleImport = async (file: File) => {
    try {
      const res = await projectsApi.importCsv(file);
      const summary = res.data;
      addToast(`Import: ${summary.created} created, ${summary.updated} updated, ${summary.skipped} skipped${summary.errors.length ? `, ${summary.errors.length} errors` : ''}`, summary.errors.length ? 'error' : 'success');
      fetchProjects();
    } catch (e) {
      addToast(e instanceof ApiClientError ? e.message : 'Failed to import CSV', 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExport = async () => {
    try {
      const blob = await projectsApi.exportCsv({
        search: searchFilter.trim() || undefined,
        category: categoryFilter || undefined,
        featured: featuredFilter === '' ? undefined : featuredFilter === 'true',
        active: activeFilter === '' ? undefined : activeFilter === 'true',
        ids: selected.size > 0 ? [...selected] : undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'portfolio.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      addToast(e instanceof ApiClientError ? e.message : 'Failed to export CSV', 'error');
    }
  };

  const filterButton = (label: string, value: string, setValue: (v: string) => void, activeValue: string) => (
    <button
      className={`btn btn--sm ${value === activeValue ? 'btn--primary' : 'btn--outline'}`}
      onClick={() => { setValue(activeValue); setPage(1); }}
    >
      {label}
    </button>
  );

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
          <button className="btn btn--outline" onClick={handleExport}>Export CSV</button>
          <button className="btn btn--outline" onClick={() => fileInputRef.current?.click()}>Import CSV</button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            aria-label="Import projects CSV"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImport(f); }}
          />
          <button className="btn btn--outline" disabled={selected.size === 0} onClick={() => setBulkAction({ ids: [...selected], kind: 'publish' })}>Publish selected</button>
          <button className="btn btn--outline" disabled={selected.size === 0} onClick={() => setBulkAction({ ids: [...selected], kind: 'unpublish' })}>Unpublish selected</button>
          <button className="btn btn--outline" disabled={selected.size === 0} onClick={() => setBulkAction({ ids: [...selected], kind: 'feature' })}>Feature selected</button>
          <button className="btn btn--outline" disabled={selected.size === 0} onClick={() => setBulkAction({ ids: [...selected], kind: 'unfeature' })}>Unfeature selected</button>
          <button className="btn btn--ghost" style={{ color: '#dc2626' }} disabled={selected.size === 0} onClick={() => setBulkAction({ ids: [...selected], kind: 'delete' })}>Delete selected</button>
        </div>
      </div>

      {bulkAction && (
        <div className="inline-confirm-bar" role="region" aria-label="Confirm bulk action">
          <span>
            {bulkAction.kind === 'delete'
              ? `Delete ${bulkAction.ids.length} selected project(s)?`
              : bulkAction.kind === 'publish'
                ? `Publish ${bulkAction.ids.length} selected project(s) on the public site?`
                : bulkAction.kind === 'unpublish'
                  ? `Unpublish ${bulkAction.ids.length} selected project(s)?`
                  : bulkAction.kind === 'feature'
                    ? `Feature ${bulkAction.ids.length} selected project(s) on the public site?`
                    : `Unfeature ${bulkAction.ids.length} selected project(s)?`}
          </span>
          <div className="form-inline">
            <button type="button" className="btn btn--primary btn--sm" disabled={bulkSaving} onClick={() => void handleBulkAction()}>
              {bulkSaving ? '...' : bulkAction.kind === 'delete' ? 'Delete' : bulkAction.kind.startsWith('un') ? 'Apply' : 'Apply'}
            </button>
            <button type="button" className="btn btn--outline btn--sm" disabled={bulkSaving} onClick={() => setBulkAction(null)}>Cancel</button>
          </div>
        </div>
      )}

      {error && <div className="alert alert--error" role="alert">{error}</div>}

      <div className="filter-bar">
        <input
          className="form-input"
          style={{ minWidth: '200px' }}
          value={searchFilter}
          placeholder="Search title, summary, tags..."
          aria-label="Search portfolio projects"
          onChange={(e) => { setSearchFilter(e.target.value); setPage(1); }}
        />
        <input
          className="form-input"
          style={{ minWidth: '140px' }}
          value={categoryFilter}
          placeholder="Category"
          aria-label="Filter by category"
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
        />
        <select className="form-select" value={statusFilter} aria-label="Filter by status" onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="live">Live</option>
          <option value="in_build">In Build</option>
        </select>
        <div className="form-inline">
          {filterButton('Featured', featuredFilter, setFeaturedFilter, 'true')}
          {filterButton('All', featuredFilter, setFeaturedFilter, '')}
        </div>
        <div className="form-inline">
          {filterButton('Active', activeFilter, setActiveFilter, 'true')}
          {filterButton('All', activeFilter, setActiveFilter, '')}
        </div>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--content-muted)', marginLeft: 'auto' }}>
          {totalCount} project{totalCount !== 1 ? 's' : ''}
        </span>
      </div>

      {editingPanel && (
        <div className="card inline-edit-panel" role="region" aria-label={editingPanel.mode === 'create' ? 'Create project' : 'Edit project'}>
          <form onSubmit={handleSubmit} noValidate>
            <div className="inline-edit-panel-title">
              <h2 className="page-title">{editingPanel.mode === 'create' ? 'Create Project' : 'Edit Project'}</h2>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Title *</label>
                <input className={`form-input${fieldErrors.title ? ' form-input--error' : ''}`} value={form.title} onChange={(e) => handleTitleChange(e.target.value)} maxLength={200} />
                {fieldErrors.title && <div className="form-error">{fieldErrors.title}</div>}
              </div>
              {editingPanel.mode !== 'edit' && (
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
                <label className="form-label">Category</label>
                <input className="form-input" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} placeholder="e.g. SaaS, Enterprise, AI" maxLength={100} />
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
                <input className={`form-input${fieldErrors.githubUrl ? ' form-input--error' : ''}`} value={form.githubUrl} onChange={(e) => setForm((p) => ({ ...p, githubUrl: e.target.value }))} placeholder="https://github.com/..." maxLength={500} />
                {fieldErrors.githubUrl && <div className="form-error">{fieldErrors.githubUrl}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Live Site URL</label>
                <input className={`form-input${fieldErrors.liveSiteUrl ? ' form-input--error' : ''}`} value={form.liveSiteUrl} onChange={(e) => setForm((p) => ({ ...p, liveSiteUrl: e.target.value }))} placeholder="https://..." maxLength={500} />
                {fieldErrors.liveSiteUrl && <div className="form-error">{fieldErrors.liveSiteUrl}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Business Purpose</label>
                <textarea className="form-textarea" value={form.businessPurpose} onChange={(e) => setForm((p) => ({ ...p, businessPurpose: e.target.value }))} rows={2} />
              </div>
              <div className="form-group">
                <label className="form-label">Problem Solved</label>
                <textarea className="form-textarea" value={form.problemSolved} onChange={(e) => setForm((p) => ({ ...p, problemSolved: e.target.value }))} rows={2} />
              </div>
              <div className="form-group">
                <label className="form-label">Solution</label>
                <textarea className="form-textarea" value={form.solution} onChange={(e) => setForm((p) => ({ ...p, solution: e.target.value }))} rows={2} />
              </div>
              <div className="form-group">
                <label className="form-label">Key Features (comma-separated)</label>
                <input className="form-input" value={form.keyFeatures.join(', ')} onChange={(e) => setForm((p) => ({ ...p, keyFeatures: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))} placeholder="Hybrid search, Audit trail, ..." />
              </div>
              <div className="form-group">
                <label className="form-label">Screenshots (comma-separated URLs)</label>
                <input className="form-input" value={form.screenshots.join(', ')} onChange={(e) => setForm((p) => ({ ...p, screenshots: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))} placeholder="https://cdn.example.com/1.png, ..." />
              </div>
              <div className="form-group">
                <label className="form-label">Duration</label>
                <input className="form-input" value={form.duration} onChange={(e) => setForm((p) => ({ ...p, duration: e.target.value }))} placeholder="e.g. 4 months" maxLength={100} />
              </div>
              <div className="form-group">
                <label className="form-label">Completed At</label>
                <input className="form-input" type="date" value={form.completedAt} onChange={(e) => setForm((p) => ({ ...p, completedAt: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Customer Reference</label>
                <input className="form-input" value={form.customerReference} onChange={(e) => setForm((p) => ({ ...p, customerReference: e.target.value }))} placeholder="e.g. National pharmacy chain" maxLength={200} />
              </div>
              <div className="form-group">
                <label className="form-label">Cover Image URL</label>
                <input className={`form-input${fieldErrors.coverImageUrl ? ' form-input--error' : ''}`} value={form.coverImageUrl} onChange={(e) => setForm((p) => ({ ...p, coverImageUrl: e.target.value }))} placeholder="https://cdn.example.com/..." maxLength={500} />
                {fieldErrors.coverImageUrl && <div className="form-error">{fieldErrors.coverImageUrl}</div>}
              </div>
              {teamOptions.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Team Members</label>
                  <div className="checkbox-group">
                    {teamOptions.map((m) => (
                      <label key={m.id} className="form-checkbox">
                        <input type="checkbox" checked={form.teamMemberIds.includes(m.id)} onChange={() => toggleTeamMember(m.id)} />
                        {m.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Case Study Body (Markdown)</label>
              <textarea className="form-textarea" value={form.caseStudyBody} onChange={(e) => setForm((p) => ({ ...p, caseStudyBody: e.target.value }))} rows={6} />
            </div>
            <div className="form-group" style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '120px' }}>
                <label className="form-label">Sort Order</label>
                <input className="form-input" type="number" value={form.sortOrder} onChange={(e) => setForm((p) => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))} />
              </div>
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center', paddingTop: '24px', flexWrap: 'wrap' }}>
                <label className="form-checkbox">
                  <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm((p) => ({ ...p, isPublished: e.target.checked }))} />
                  Published
                </label>
                <label className="form-checkbox">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} />
                  Active
                </label>
                <label className="form-checkbox">
                  <input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm((p) => ({ ...p, isFeatured: e.target.checked }))} />
                  Featured
                </label>
                <label className="form-checkbox">
                  <input type="checkbox" checked={form.showCustomerReference} onChange={(e) => setForm((p) => ({ ...p, showCustomerReference: e.target.checked }))} />
                  Show customer reference publicly
                </label>
              </div>
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
                    <SortableTh label="Title" sortKey="title" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
                    <SortableTh label="Status" sortKey="status" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
                    <th>Tags</th>
                    <SortableTh label="Featured" sortKey="isFeatured" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
                    <SortableTh label="Active" sortKey="isActive" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
                    <SortableTh label="Published" sortKey="isPublished" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
                    <SortableTh label="Order" sortKey="sortOrder" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
                    <SortableTh label="Created" sortKey="createdAt" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProjects.map((p) => (
                    <tr key={p.id}>
                      <td><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelected(p.id)} aria-label={`Select ${p.title}`} /></td>
                      <td style={{ fontWeight: 600 }}>{p.title}</td>
                      <td><span className={`badge badge--${p.status}`}>{p.status}</span></td>
                      <td>
                        {p.stackTags.slice(0, 3).map((t) => (
                          <span key={t} className="badge badge--neutral" style={{ marginRight: 4 }}>{t}</span>
                        ))}
                        {p.stackTags.length > 3 && <span className="badge badge--neutral">+{p.stackTags.length - 3}</span>}
                      </td>
                      <td>
                        <button
                          className={`btn btn--sm ${p.isFeatured ? 'btn--primary' : 'btn--outline'}`}
                          onClick={() => handleSetFlag('featured', p.id, !p.isFeatured)}
                          title={p.isFeatured ? 'Remove from featured' : 'Feature on homepage'}
                        >
                          {p.isFeatured ? '★' : '☆'}
                        </button>
                      </td>
                      <td>
                        <button
                          className={`btn btn--sm ${p.isActive ? 'btn--outline' : 'btn--ghost'}`}
                          onClick={() => handleSetFlag('active', p.id, !p.isActive)}
                          title={p.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {p.isActive ? 'Active' : 'Off'}
                        </button>
                      </td>
                      <td><span className={`badge ${p.isPublished ? 'badge--published' : 'badge--unpublished'}`}>{p.isPublished ? 'Yes' : 'No'}</span></td>
                      <td>{p.sortOrder}</td>
                      <td>{new Date(p.createdAt).toLocaleDateString()}</td>
                      <td>
                        <div className="form-inline">
                          <button className="btn btn--outline btn--sm" onClick={() => openEdit(p)}>Edit</button>
                          <button className="btn btn--outline btn--sm" disabled={refreshing.has(p.id)} onClick={() => handleAiRefresh(p.id)}>
                            {refreshing.has(p.id) ? '...' : 'AI Draft'}
                          </button>
                          <InlineConfirm
                            onConfirm={() => handleDelete(p.id)}
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
        {totalCount > pageSize && (
          <Pagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} />
        )}
      </div>
    </div>
  );
}
