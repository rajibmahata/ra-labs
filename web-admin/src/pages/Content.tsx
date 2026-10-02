import { useState, useEffect, useMemo, type FormEvent, type KeyboardEvent } from 'react';
import { content as contentApi, ApiClientError } from '../api/client';
import { InlineConfirm } from '../components/InlineConfirm';
import { SortableTh, type SortDirection } from '../components/SortableTh';
import { useToast } from '../components/useToast';
import type { ContentEntry } from '../types';

const SUPPORTED_LOCALES = ['en', 'bn', 'hi', 'es', 'fr', 'pt', 'sw', 'de', 'ja', 'ko', 'zh'];

type EditingPanel =
  | { mode: 'create' }
  | { mode: 'edit'; entry: ContentEntry }
  | null;

const groupOf = (key: string): string => key.split('.')[0] || 'other';

export default function Content() {
  const { addToast, ToastContainer } = useToast();
  const [entries, setEntries] = useState<ContentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [localeFilter, setLocaleFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [sortKey, setSortKey] = useState('');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [editingPanel, setEditingPanel] = useState<EditingPanel>(null);
  const [form, setForm] = useState({ key: '', locale: 'en', value: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const fetchEntries = async () => {
    setLoading(true);
    setError('');
    try {
      const params: { locale?: string; pageSize: number } = { pageSize: 200 };
      if (localeFilter) params.locale = localeFilter;
      const res = await contentApi.list(params);
      setEntries(res.data as ContentEntry[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load content');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEntries(); }, [localeFilter]);

  const groups = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      const group = groupOf(entry.key);
      counts.set(group, (counts.get(group) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  }, [entries]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const visibleEntries = useMemo(() => {
    let filtered = groupFilter ? entries.filter((entry) => groupOf(entry.key) === groupFilter) : entries;
    const q = searchFilter.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((entry) =>
        [entry.key, entry.locale, entry.value].some((v) => v.toLowerCase().includes(q)),
      );
    }
    const sorted = [...filtered];
    if (sortKey) {
      const dir = sortDirection === 'asc' ? 1 : -1;
      sorted.sort((a, b) => {
        const av = (a as unknown as Record<string, string>)[sortKey] ?? '';
        const bv = (b as unknown as Record<string, string>)[sortKey] ?? '';
        return String(av).localeCompare(String(bv)) * dir;
      });
    }
    return sorted;
  }, [entries, groupFilter, searchFilter, sortKey, sortDirection]);

  const openCreate = () => {
    setEditingPanel({ mode: 'create' });
    setForm({ key: '', locale: 'en', value: '' });
    setFieldErrors({});
  };

  const openEdit = (entry: ContentEntry) => {
    setEditingPanel({ mode: 'edit', entry });
    setForm({ key: entry.key, locale: entry.locale, value: entry.value });
    setFieldErrors({});
  };

  const closePanel = () => {
    setEditingPanel(null);
    setFieldErrors({});
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (editingPanel?.mode !== 'edit') {
      if (!form.key.trim()) errs.key = 'Key is required';
      else if (form.key.length > 200) errs.key = 'Key must be 200 characters or fewer';
    }
    if (!form.locale) errs.locale = 'Locale is required';
    if (!form.value.trim()) errs.value = 'Value is required';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const isEdit = editingPanel?.mode === 'edit';
      if (isEdit) {
        await contentApi.update(editingPanel.entry.key, { locale: form.locale, value: form.value.trim() });
        addToast('Content updated', 'success');
      } else {
        await contentApi.create({ key: form.key.trim(), locale: form.locale, value: form.value.trim() });
        addToast('Content created', 'success');
      }
      closePanel();
      fetchEntries();
    } catch (e) {
      if (e instanceof ApiClientError) {
        addToast(e.message, 'error');
        if (e.code === 'CONFLICT') {
          setFieldErrors((prev) => ({ ...prev, key: 'This key+locale combination already exists' }));
        }
      } else {
        addToast('Failed to save content', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>, tabNames: string[]) => {
    const current = groupFilter;
    const idx = tabNames.indexOf(current);
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = (idx + 1) % tabNames.length;
      setGroupFilter(tabNames[next]);
      (e.currentTarget.parentElement?.children[next] as HTMLElement)?.focus();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = (idx - 1 + tabNames.length) % tabNames.length;
      setGroupFilter(tabNames[prev]);
      (e.currentTarget.parentElement?.children[prev] as HTMLElement)?.focus();
    }
  };

  const handleDelete = async (entry: ContentEntry) => {
    try {
      await contentApi.delete(entry.key, entry.locale);
      addToast('Content deleted', 'success');
      fetchEntries();
    } catch (e) {
      addToast(e instanceof ApiClientError ? e.message : 'Failed to delete content', 'error');
    }
  };

  const handleExport = async () => {
    try {
      const blob = await contentApi.exportCsv(localeFilter || undefined);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'content.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      addToast(e instanceof ApiClientError ? e.message : 'Failed to export CSV', 'error');
    }
  };

  return (
    <div>
      <ToastContainer />
      <div className="page-header">
        <div>
          <h1 className="page-title">Content</h1>
          <p className="page-subtitle">Manage multi-language page content. Changes appear live on the public site.</p>
        </div>
        <div className="form-inline">
          <button className="btn btn--outline" onClick={handleExport}>Export CSV</button>
          <button className="btn btn--primary" onClick={openCreate}>Add Entry</button>
        </div>
      </div>

      <div className="filter-bar">
        <input
          className="form-input"
          style={{ minWidth: '220px' }}
          value={searchFilter}
          placeholder="Search key, value, locale..."
          aria-label="Search content entries"
          onChange={(e) => setSearchFilter(e.target.value)}
        />
        <select className="form-select" value={localeFilter} onChange={(e) => setLocaleFilter(e.target.value)}>
          <option value="">All locales</option>
          {SUPPORTED_LOCALES.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--content-muted)', marginLeft: 'auto' }}>
          {visibleEntries.length} of {entries.length} entries
        </span>
      </div>

      {groups.length > 1 && (() => {
        const tabNames = ['', ...groups.map((g) => g.name)];
        return (
        <div className="content-tabs" role="tablist" aria-label="Content groups">
          <button
            type="button"
            role="tab"
            id="tab-group-all"
            aria-selected={!groupFilter}
            tabIndex={!groupFilter ? 0 : -1}
            className={`content-tab${!groupFilter ? ' content-tab--active' : ''}`}
            onClick={() => setGroupFilter('')}
            onKeyDown={(e) => handleTabKeyDown(e, tabNames)}
          >
            All <span className="content-tab-count">{entries.length}</span>
          </button>
          {groups.map((group) => (
            <button
              key={group.name}
              type="button"
              role="tab"
              id={`tab-group-${group.name}`}
              aria-selected={groupFilter === group.name}
              tabIndex={groupFilter === group.name ? 0 : -1}
              className={`content-tab${groupFilter === group.name ? ' content-tab--active' : ''}`}
              onClick={() => setGroupFilter(group.name)}
              onKeyDown={(e) => handleTabKeyDown(e, tabNames)}
            >
              {group.name} <span className="content-tab-count">{group.count}</span>
            </button>
          ))}
        </div>
        );
      })()}

      {error && <div className="alert alert--error" role="alert">{error}</div>}

      {editingPanel && (
        <div className="card inline-edit-panel" role="region" aria-label={editingPanel.mode === 'edit' ? 'Edit content entry' : 'Create content entry'}>
          <form onSubmit={handleSubmit} noValidate>
            <div className="inline-edit-panel-title">
              <h2 className="page-title">{editingPanel.mode === 'edit' ? 'Edit Content Entry' : 'Create Content Entry'}</h2>
            </div>
            <div className="form-group">
              <label className="form-label">Key {editingPanel.mode !== 'edit' && '*'}</label>
              <input
                className={`form-input${fieldErrors.key ? ' form-input--error' : ''}`}
                value={form.key}
                onChange={(e) => setForm((p) => ({ ...p, key: e.target.value }))}
                disabled={editingPanel.mode === 'edit'}
                placeholder="hero.headline"
                maxLength={200}
              />
              {fieldErrors.key && <div className="form-error">{fieldErrors.key}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Locale *</label>
              <select
                className={`form-select${fieldErrors.locale ? ' form-select--error' : ''}`}
                value={form.locale}
                onChange={(e) => setForm((p) => ({ ...p, locale: e.target.value }))}
                disabled={editingPanel.mode === 'edit'}
              >
                {SUPPORTED_LOCALES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              {fieldErrors.locale && <div className="form-error">{fieldErrors.locale}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Value *</label>
              <textarea
                className={`form-textarea${fieldErrors.value ? ' form-textarea--error' : ''}`}
                value={form.value}
                onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))}
                rows={5}
              />
              {fieldErrors.value && <div className="form-error">{fieldErrors.value}</div>}
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

      <div className="card" role="tabpanel" id="tabpanel-content" aria-labelledby={groupFilter ? `tab-group-${groupFilter}` : 'tab-group-all'}>
        <div className="card-body card-body--flush">
          {loading ? (
            <div className="page-loader"><div className="spinner" /></div>
          ) : visibleEntries.length === 0 ? (
            <div className="state-message">
              <span className="state-message-icon">📝</span>
              <h3>No content entries</h3>
              <p>{localeFilter || groupFilter ? `No entries found for "${groupFilter || 'all keys'}" in locale "${localeFilter || 'all locales'}".` : 'Create content entries to manage site copy.'}</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <SortableTh label="Key" sortKey="key" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
                    <SortableTh label="Locale" sortKey="locale" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
                    <th>Value</th>
                    <SortableTh label="Updated" sortKey="updatedAt" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleEntries.map((entry) => (
                    <tr key={`${entry.key}-${entry.locale}`}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)' }}>{entry.key}</td>
                      <td><span className="badge badge--neutral">{entry.locale}</span></td>
                      <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.value}</td>
                      <td>{entry.updatedAt ? new Date(entry.updatedAt).toLocaleDateString() : '—'}</td>
                      <td>
                        <div className="form-inline">
                          <button className="btn btn--outline btn--sm" onClick={() => openEdit(entry)}>Edit</button>
                          <InlineConfirm
                            onConfirm={() => handleDelete(entry)}
                            buttonLabel="Delete"
                            confirmLabel="Delete"
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
      </div>
    </div>
  );
}
