import { useEffect, useState } from 'react';
import { drafts } from '../api/client';

type Draft = { id: string; title: string; summary: string; body?: string | null; sourceUrl?: string | null; status: string; createdAt: string };

export default function Drafts() {
  const [items, setItems] = useState<Draft[]>([]);
  const [error, setError] = useState('');

  const load = async () => {
    try { setItems((await drafts.list()).data); } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load drafts.'); }
  };

  useEffect(() => { void load(); }, []);

  const review = async (id: string, decision: 'approve' | 'reject') => {
    try { await drafts.review(id, decision); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Review failed.'); }
  };

  return (
    <section className="page-section">
      <div className="page-heading"><div><p className="eyebrow">Content operations</p><h1>AI drafts</h1></div></div>
      {error && <div className="alert error">{error}</div>}
      {items.length === 0 ? <div className="empty-state">No pending drafts.</div> : items.map((draft) => (
        <article className="content-card" key={draft.id}>
          <div className="card-header"><div><h2>{draft.title}</h2><p>{draft.summary}</p></div><span className="badge">{draft.status}</span></div>
          {draft.body && <p className="draft-body">{draft.body}</p>}
          {draft.sourceUrl && <a href={draft.sourceUrl} target="_blank" rel="noreferrer">View source</a>}
          <div className="form-actions"><button className="btn btn-primary" onClick={() => void review(draft.id, 'approve')}>Approve to projects</button><button className="btn btn-secondary" onClick={() => void review(draft.id, 'reject')}>Reject</button></div>
        </article>
      ))}
    </section>
  );
}