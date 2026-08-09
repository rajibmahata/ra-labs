import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { reviews as reviewsApi, ApiClientError } from '../api/client';
import { ConfirmDialog } from '../components/Modal';
import { useToast } from '../components/useToast';

type Review = Awaited<ReturnType<typeof reviewsApi.list>>['data'][number];

export default function Reviews() {
  const { addToast, ToastContainer } = useToast();
  const [items, setItems] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [publishedFilter, setPublishedFilter] = useState<'all' | 'published' | 'pending'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<{ ids: string[]; approved: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchReviews = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await reviewsApi.list({
        page,
        pageSize: 20,
        search: search.trim() || undefined,
        published: publishedFilter === 'all' ? undefined : publishedFilter === 'published',
      });
      setItems(result.data);
      setTotalPages(result.pagination.totalPages);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchReviews(); }, [page, publishedFilter]);

  const toggleSelected = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected((current) => current.size === items.length ? new Set() : new Set(items.map((item) => item.id)));
  };

  const moderate = async () => {
    if (!confirm) return;
    setSaving(true);
    try {
      await Promise.all(confirm.ids.map((id) => reviewsApi.moderate(id, confirm.approved)));
      addToast(confirm.approved ? 'Review approved for publishing' : 'Review unpublished', 'success');
      setConfirm(null);
      await fetchReviews();
    } catch (e) {
      addToast(e instanceof ApiClientError ? e.message : 'Failed to update review status', 'error');
    } finally {
      setSaving(false);
    }
  };

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(1);
    void fetchReviews();
  };

  return (
    <div>
      <ToastContainer />
      <div className="page-header">
        <div>
          <h1 className="page-title">Reviews</h1>
          <p className="page-subtitle">Review, approve, and manage customer feedback before it appears publicly.</p>
        </div>
        <div className="form-inline">
          <button className="btn btn--primary" disabled={selected.size === 0} onClick={() => setConfirm({ ids: [...selected], approved: true })}>Approve selected</button>
          <button className="btn btn--outline" disabled={selected.size === 0} onClick={() => setConfirm({ ids: [...selected], approved: false })}>Unpublish selected</button>
        </div>
      </div>

      <form className="card" onSubmit={submitSearch} style={{ marginBottom: '16px' }}>
        <div className="card-body form-inline">
          <input className="form-input" style={{ minWidth: '280px' }} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer, project, or review" aria-label="Search reviews" />
          <button className="btn btn--outline" type="submit">Search</button>
          <select className="form-input" value={publishedFilter} onChange={(event) => { setPage(1); setPublishedFilter(event.target.value as typeof publishedFilter); }} aria-label="Review status">
            <option value="all">All reviews</option>
            <option value="pending">Pending approval</option>
            <option value="published">Published</option>
          </select>
        </div>
      </form>

      {error && <div className="alert alert--error" role="alert">{error}</div>}
      <div className="card">
        <div className="card-body card-body--flush">
          {loading ? <div className="page-loader"><div className="spinner" /></div> : items.length === 0 ? (
            <div className="state-message"><span className="state-message-icon">★</span><h3>No reviews found</h3><p>Submitted customer feedback will appear here for moderation.</p></div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th><input type="checkbox" checked={selected.size === items.length && items.length > 0} onChange={selectAll} aria-label="Select all reviews" /></th>
                    <th>Customer</th><th>Project</th><th>Rating</th><th>Review</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td><input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelected(item.id)} aria-label={`Select review from ${item.customerName}`} /></td>
                      <td style={{ fontWeight: 600 }}>{item.customerName}</td>
                      <td><Link to={`/admin/projects/${item.customerProjectId}`}>{item.projectTitle}</Link></td>
                      <td>{'★'.repeat(item.rating)}<span style={{ color: 'var(--content-muted)' }}>{'★'.repeat(5 - item.rating)}</span></td>
                      <td style={{ maxWidth: '360px' }}>{item.comment}</td>
                      <td><span className={`badge ${item.isPublished ? 'badge--published' : 'badge--unpublished'}`}>{item.isPublished ? 'Published' : 'Pending'}</span></td>
                      <td><button className="btn btn--outline btn--sm" onClick={() => setConfirm({ ids: [item.id], approved: !item.isPublished })}>{item.isPublished ? 'Unpublish' : 'Approve'}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {totalPages > 1 && <div className="card-header" style={{ justifyContent: 'center' }}><div className="form-inline"><button className="btn btn--outline btn--sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--content-muted)' }}>Page {page} of {totalPages}</span><button className="btn btn--outline btn--sm" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Next</button></div></div>}
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => void moderate()}
        title={confirm?.approved ? 'Approve review?' : 'Unpublish review?'}
        message={confirm?.approved ? 'This review will become eligible for public display.' : 'This review will be removed from public display.'}
        confirmLabel={confirm?.approved ? 'Approve' : 'Unpublish'}
        loading={saving}
      />
    </div>
  );
}