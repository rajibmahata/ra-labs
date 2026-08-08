import { useState, useEffect, type FormEvent } from 'react';
import { content as contentApi, ApiClientError } from '../api/client';
import { Modal, ConfirmDialog } from '../components/Modal';
import { useToast } from '../components/useToast';
import type { ContentEntry } from '../types';

const SUPPORTED_LOCALES = ['en', 'bn', 'hi', 'es', 'fr', 'pt', 'sw', 'de', 'ja', 'ko', 'zh'];

export default function Content() {
  const { addToast, ToastContainer } = useToast();
  const [entries, setEntries] = useState<ContentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [localeFilter, setLocaleFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ContentEntry | null>(null);
  const [form, setForm] = useState({ key: '', locale: 'en', value: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ContentEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const openCreate = () => {
    setEditingEntry(null);
    setForm({ key: '', locale: 'en', value: '' });
    setFieldErrors({});
    setModalOpen(true);
  };

  const openEdit = (entry: ContentEntry) => {
    setEditingEntry(entry);
    setForm({ key: entry.key, locale: entry.locale, value: entry.value });
    setFieldErrors({});
    setModalOpen(true);
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!editingEntry && !form.key.trim()) errs.key = 'Key is required';
    else if (!editingEntry && form.key.length > 200) errs.key = 'Key must be 200 characters or fewer';
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
      if (editingEntry) {
        // Use PUT /api/v1/admin/content/{key}
        await contentApi.update(editingEntry.key, { locale: form.locale, value: form.value.trim() });
        addToast('Content updated', 'success');
      } else {
        await contentApi.create({ key: form.key.trim(), locale: form.locale, value: form.value.trim() });
        addToast('Content created', 'success');
      }
      setModalOpen(false);
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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await contentApi.delete(deleteTarget.key, deleteTarget.locale);
      addToast('Content deleted', 'success');
      setDeleteTarget(null);
      fetchEntries();
    } catch (e) {
      addToast(e instanceof ApiClientError ? e.message : 'Failed to delete content', 'error');
    } finally {
      setDeleting(false);
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
        <button className="btn btn--primary" onClick={openCreate}>Add Entry</button>
      </div>

      <div className="filter-bar">
        <select className="form-select" value={localeFilter} onChange={(e) => setLocaleFilter(e.target.value)}>
          <option value="">All locales</option>
          {SUPPORTED_LOCALES.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      {error && <div className="alert alert--error" role="alert">{error}</div>}

      <div className="card">
        <div className="card-body card-body--flush">
          {loading ? (
            <div className="page-loader"><div className="spinner" /></div>
          ) : entries.length === 0 ? (
            <div className="state-message">
              <span className="state-message-icon">📝</span>
              <h3>No content entries</h3>
              <p>{localeFilter ? `No entries found for locale "${localeFilter}".` : 'Create content entries to manage site copy.'}</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Locale</th>
                    <th>Value</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={`${entry.key}-${entry.locale}`}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)' }}>{entry.key}</td>
                      <td><span className="badge badge--neutral">{entry.locale}</span></td>
                      <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.value}</td>
                      <td>{entry.updatedAt ? new Date(entry.updatedAt).toLocaleDateString() : '—'}</td>
                      <td>
                        <div className="form-inline">
                          <button className="btn btn--outline btn--sm" onClick={() => openEdit(entry)}>Edit</button>
                          <button className="btn btn--ghost btn--sm" style={{ color: '#dc2626' }} onClick={() => setDeleteTarget(entry)}>Delete</button>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingEntry ? 'Edit Content Entry' : 'Create Content Entry'} width="560px">
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label">Key {!editingEntry && '*'}</label>
            <input
              className={`form-input${fieldErrors.key ? ' form-input--error' : ''}`}
              value={form.key}
              onChange={(e) => setForm((p) => ({ ...p, key: e.target.value }))}
              disabled={!!editingEntry}
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
              disabled={!!editingEntry}
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
            <button type="button" className="btn btn--outline" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving...' : (editingEntry ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Content Entry"
        message={`Delete content entry "${deleteTarget?.key}" (${deleteTarget?.locale})? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  );
}
