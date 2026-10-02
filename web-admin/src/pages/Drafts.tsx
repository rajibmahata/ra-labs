import { useEffect, useState } from 'react';
import { drafts } from '../api/client';

type Draft = { id: string; title: string; summary: string; body?: string | null; sourceUrl?: string | null; status: string; createdAt: string };

export default function Drafts() {
  const [items, setItems] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setItems((await drafts.list()).data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load drafts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const review = async (id: string, decision: 'approve' | 'reject') => {
    try { await drafts.review(id, decision); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Review failed.'); }
  };

  if (loading) {
    return (
      <div className="page-loader"><div className="spinner" /></div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">AI drafts</h1>
          <p className="page-subtitle">Content operations — review AI-generated drafts.</p>
        </div>
      </div>
      {error && <div className="alert alert--error" role="alert">{error}</div>}
      {items.length === 0 ? (
        <div className="card">
          <div className="card-body">
            <div className="state-message">
              <span className="state-message-icon">✦</span>
              <h3>No pending drafts</h3>
              <p>AI-generated content drafts will appear here for review.</p>
            </div>
          </div>
        </div>
      ) : (
        items.map((draft) => (
          <div className="card" key={draft.id} style={{ marginBottom: 'var(--space-4)' }}>
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-1)' }}>{draft.title}</h2>
                  <p style={{ color: 'var(--content-muted)', marginBottom: 'var(--space-3)' }}>{draft.summary}</p>
                </div>
                <span className="badge">{draft.status}</span>
              </div>
              {draft.body && <p style={{ whiteSpace: 'pre-wrap', marginBottom: 'var(--space-3)' }}>{draft.body}</p>}
              {draft.sourceUrl && <a href={draft.sourceUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginBottom: 'var(--space-3)' }}>View source</a>}
              <div className="form-actions">
                <button className="btn btn--primary" onClick={() => void review(draft.id, 'approve')}>Approve to projects</button>
                <button className="btn btn--outline" onClick={() => void review(draft.id, 'reject')}>Reject</button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
