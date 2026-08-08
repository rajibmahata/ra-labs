import { useState, useEffect, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { customerProjects as cpApi, ApiClientError } from '../api/client';
import { useToast } from '../components/useToast';
import type { CustomerProject, CustomerDocument, ClientPrd, Demo, Invoice, Feedback } from '../types';

const STATUSES = ['intake', 'prd_draft', 'prd_signed', 'in_build', 'demo', 'delivered', 'closed'] as const;

const STATUS_LABELS: Record<string, string> = {
  intake: 'Intake',
  prd_draft: 'PRD Draft',
  prd_signed: 'PRD Signed',
  in_build: 'In Build',
  demo: 'Demo',
  delivered: 'Delivered',
  closed: 'Closed',
};

const STATUS_BADGE: Record<string, string> = {
  intake: 'badge--new',
  prd_draft: 'badge--in_build',
  prd_signed: 'badge--new',
  in_build: 'badge--in_build',
  demo: 'badge--intervention',
  delivered: 'badge--live',
  closed: 'badge--neutral',
};

const CURRENCIES = ['USD', 'EUR', 'GBP', 'BDT', 'INR', 'CAD', 'AUD'] as const;

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString();
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast, ToastContainer } = useToast();

  // Project data
  const [project, setProject] = useState<CustomerProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Admin notes
  const [adminNotes, setAdminNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Status transition
  const [selectedStatus, setSelectedStatus] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);

  // Documents
  const [documents, setDocuments] = useState<CustomerDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  // PRD
  const [prd, setPrd] = useState<ClientPrd | null>(null);
  const [prdContent, setPrdContent] = useState('');
  const [prdLoading, setPrdLoading] = useState(false);
  const [savingPrd, setSavingPrd] = useState(false);
  const [signingPrd, setSigningPrd] = useState(false);

  // Demo
  const [demo, setDemo] = useState<Demo | null>(null);
  const [demoForm, setDemoForm] = useState({ type: 'screenshot' as 'screenshot' | 'url', urlOrAsset: '', notes: '' });
  const [demoFieldErrors, setDemoFieldErrors] = useState<Record<string, string>>({});
  const [addingDemo, setAddingDemo] = useState(false);

  // Invoices
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceForm, setInvoiceForm] = useState({ amount: '', currency: 'USD', status: 'unpaid' as 'unpaid' | 'paid_cash', notes: '' });
  const [invoiceFieldErrors, setInvoiceFieldErrors] = useState<Record<string, string>>({});
  const [addingInvoice, setAddingInvoice] = useState(false);

  // Feedback
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [approvingFeedback, setApprovingFeedback] = useState(false);

  // === Fetch project ===
  const fetchProject = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await cpApi.get(id);
      const p = res.data as CustomerProject;
      setProject(p);
      setAdminNotes(p.adminNotes ?? '');
      setSelectedStatus(p.status);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProject(); }, [id]);

  // === Fetch sub-resources ===
  const fetchDocuments = async () => {
    if (!id) return;
    setDocsLoading(true);
    try {
      const res = await cpApi.getDocuments(id);
      setDocuments(res.data as CustomerDocument[]);
    } catch (e) {
      addToast(e instanceof ApiClientError ? e.message : 'Failed to load documents', 'error');
    } finally {
      setDocsLoading(false);
    }
  };

  const fetchPrd = async () => {
    if (!id) return;
    setPrdLoading(true);
    try {
      const res = await cpApi.getPrd(id);
      const prdData = res.data as ClientPrd | null;
      setPrd(prdData);
      setPrdContent(prdData?.content ?? '');
    } catch (e) {
      addToast(e instanceof ApiClientError ? e.message : 'Failed to load PRD', 'error');
    } finally {
      setPrdLoading(false);
    }
  };

  const fetchDemo = async () => {
    if (!id) return;
    try {
      const res = await cpApi.getDemo(id);
      setDemo(res.data as Demo | null);
    } catch (e) {
      // Demo may not exist yet; that's okay
    }
  };

  const fetchInvoices = async () => {
    if (!id) return;
    try {
      const res = await cpApi.getInvoices(id);
      setInvoices(res.data as Invoice[]);
    } catch (e) {
      addToast(e instanceof ApiClientError ? e.message : 'Failed to load invoices', 'error');
    }
  };

  const fetchFeedback = async () => {
    if (!id) return;
    try {
      const res = await cpApi.getFeedback(id);
      setFeedback(res.data as Feedback | null);
    } catch (e) {
      // Feedback may not exist yet
    }
  };

  useEffect(() => {
    if (!project) return;
    fetchDocuments();
    fetchPrd();
    fetchDemo();
    fetchInvoices();
    fetchFeedback();
  }, [project]);

  // === Admin Notes ===
  const handleSaveNotes = async () => {
    if (!id) return;
    setSavingNotes(true);
    try {
      const res = await cpApi.update(id, { adminNotes });
      setProject(res.data as CustomerProject);
      addToast('Notes saved', 'success');
    } catch (e) {
      addToast(e instanceof ApiClientError ? e.message : 'Failed to save notes', 'error');
    } finally {
      setSavingNotes(false);
    }
  };

  // === Status ===
  const handleSaveStatus = async () => {
    if (!id || !selectedStatus) return;
    setSavingStatus(true);
    try {
      const res = await cpApi.update(id, { status: selectedStatus });
      setProject(res.data as CustomerProject);
      addToast(`Status updated to ${STATUS_LABELS[selectedStatus] ?? selectedStatus}`, 'success');
    } catch (e) {
      addToast(e instanceof ApiClientError ? e.message : 'Failed to update status', 'error');
    } finally {
      setSavingStatus(false);
    }
  };

  // === PRD ===
  const handleSavePrd = async (e: FormEvent) => {
    e.preventDefault();
    if (!id) return;
    if (!prdContent.trim()) {
      addToast('PRD content is required', 'error');
      return;
    }
    setSavingPrd(true);
    try {
      const res = await cpApi.savePrd(id, { content: prdContent });
      setPrd(res.data as ClientPrd);
      addToast('PRD saved', 'success');
    } catch (e) {
      addToast(e instanceof ApiClientError ? e.message : 'Failed to save PRD', 'error');
    } finally {
      setSavingPrd(false);
    }
  };

  const handleSignPrd = async () => {
    if (!id) return;
    setSigningPrd(true);
    try {
      const res = await cpApi.signPrdAdmin(id);
      setPrd(res.data as ClientPrd);
      addToast('PRD signed as admin', 'success');
    } catch (e) {
      addToast(e instanceof ApiClientError ? e.message : 'Failed to sign PRD', 'error');
    } finally {
      setSigningPrd(false);
    }
  };

  // === Demo ===
  const validateDemo = (): boolean => {
    const errs: Record<string, string> = {};
    if (!demoForm.urlOrAsset.trim()) errs.urlOrAsset = 'URL or asset is required';
    else if (demoForm.urlOrAsset.length > 2000) errs.urlOrAsset = 'Must be 2000 characters or fewer';
    if (!['screenshot', 'url'].includes(demoForm.type)) errs.type = 'Type must be screenshot or url';
    setDemoFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleAddDemo = async (e: FormEvent) => {
    e.preventDefault();
    if (!id || !validateDemo()) return;
    setAddingDemo(true);
    try {
      const res = await cpApi.addDemo(id, {
        type: demoForm.type,
        urlOrAsset: demoForm.urlOrAsset.trim(),
        notes: demoForm.notes.trim() || undefined,
      });
      setDemo(res.data as Demo);
      setDemoForm({ type: 'screenshot', urlOrAsset: '', notes: '' });
      setDemoFieldErrors({});
      addToast('Demo added', 'success');
    } catch (e) {
      addToast(e instanceof ApiClientError ? e.message : 'Failed to add demo', 'error');
    } finally {
      setAddingDemo(false);
    }
  };

  // === Invoice ===
  const validateInvoice = (): boolean => {
    const errs: Record<string, string> = {};
    const amount = parseFloat(invoiceForm.amount);
    if (isNaN(amount) || amount <= 0) errs.amount = 'Amount must be greater than 0';
    if (!/^[A-Z]{3}$/.test(invoiceForm.currency)) errs.currency = 'Currency must be 3 uppercase letters';
    if (!['unpaid', 'paid_cash'].includes(invoiceForm.status)) errs.status = 'Invalid status';
    setInvoiceFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleAddInvoice = async (e: FormEvent) => {
    e.preventDefault();
    if (!id || !validateInvoice()) return;
    setAddingInvoice(true);
    try {
      const res = await cpApi.createInvoice(id, {
        amount: parseFloat(invoiceForm.amount),
        currency: invoiceForm.currency,
        status: invoiceForm.status,
        notes: invoiceForm.notes.trim() || undefined,
      });
      setInvoices((prev) => [...prev, res.data as Invoice]);
      setInvoiceForm({ amount: '', currency: 'USD', status: 'unpaid', notes: '' });
      setInvoiceFieldErrors({});
      addToast('Invoice created', 'success');
    } catch (e) {
      addToast(e instanceof ApiClientError ? e.message : 'Failed to create invoice', 'error');
    } finally {
      setAddingInvoice(false);
    }
  };

  // === Feedback ===
  const handleApproveFeedback = async () => {
    if (!id) return;
    setApprovingFeedback(true);
    try {
      const res = await cpApi.approveFeedback(id);
      setFeedback(res.data as Feedback);
      addToast('Feedback approved for publishing', 'success');
    } catch (e) {
      addToast(e instanceof ApiClientError ? e.message : 'Failed to approve feedback', 'error');
    } finally {
      setApprovingFeedback(false);
    }
  };

  // === Loading / Error ===
  if (loading) {
    return (
      <div className="page-loader">
        <div className="spinner" />
        <p>Loading project...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Project</h1>
          </div>
        </div>
        <div className="state-message">
          <span className="state-message-icon">📋</span>
          <h3>Project not found</h3>
          <p>{error || 'The requested project could not be loaded.'}</p>
          <button className="btn btn--outline" onClick={() => navigate('/admin/projects')}>Back to Projects</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ToastContainer />

      {/* Breadcrumb */}
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <button className="btn btn--ghost btn--sm" onClick={() => navigate('/admin/projects')}>
          &larr; Back to Projects
        </button>
      </div>

      {/* ================================================================
          HEADER
          ================================================================ */}
      <div className="card">
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
            <div>
              <h1 className="page-title" style={{ marginBottom: 'var(--space-1)' }}>{project.title}</h1>
              <div className="form-inline" style={{ marginTop: 'var(--space-2)' }}>
                <span className={`badge ${STATUS_BADGE[project.status] ?? 'badge--neutral'}`}>{STATUS_LABELS[project.status] ?? project.status}</span>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--content-muted)' }}>
                  Customer: {project.customerId.slice(0, 8)}...
                </span>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--content-muted)' }}>
                  Created: {formatDateShort(project.createdAt)}
                </span>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--content-muted)' }}>
                  Updated: {formatDateShort(project.updatedAt)}
                </span>
              </div>
            </div>
            {project.chatThreadId && (
              <button className="btn btn--outline" onClick={() => navigate(`/admin/chat?threadId=${project.chatThreadId}`)}>
                Open Chat Thread
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ================================================================
          STATUS TRANSITION + ADMIN NOTES
          ================================================================ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        {/* Status Transition */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Status</h2>
          </div>
          <div className="card-body">
            <div className="form-inline" style={{ gap: 'var(--space-3)' }}>
              <select
                className="form-select"
                style={{ width: 'auto', minWidth: '180px' }}
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                aria-label="Project status"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
              <button
                className="btn btn--primary btn--sm"
                onClick={handleSaveStatus}
                disabled={savingStatus || selectedStatus === project.status}
              >
                {savingStatus ? 'Saving...' : 'Update Status'}
              </button>
            </div>
            <div className="form-hint" style={{ marginTop: 'var(--space-2)' }}>
              The server enforces valid state transitions (400/409 on invalid transitions).
            </div>
          </div>
        </div>

        {/* Admin Notes */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Admin Notes</h2>
          </div>
          <div className="card-body">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="pd-notes">Notes</label>
              <textarea
                id="pd-notes"
                className="form-textarea"
                rows={4}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                maxLength={5000}
                placeholder="Internal admin notes about this project..."
              />
            </div>
            <div className="form-actions" style={{ marginTop: 'var(--space-3)' }}>
              <button
                className="btn btn--primary btn--sm"
                onClick={handleSaveNotes}
                disabled={savingNotes}
              >
                {savingNotes ? 'Saving...' : 'Save Notes'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================
          DOCUMENTS
          ================================================================ */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="card-header">
          <h2 className="card-title">Documents</h2>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--content-muted)' }}>
            Uploaded by the customer
          </span>
        </div>
        <div className="card-body card-body--flush">
          {docsLoading ? (
            <div style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
              <div className="spinner" style={{ margin: '0 auto' }} />
            </div>
          ) : documents.length === 0 ? (
            <div className="state-message" style={{ padding: 'var(--space-6)' }}>
              <p>No documents uploaded yet.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>File Name</th>
                    <th>Uploaded By</th>
                    <th>Description</th>
                    <th>Uploaded</th>
                    <th>Link</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id}>
                      <td style={{ fontWeight: 500 }}>{doc.fileName}</td>
                      <td>{doc.uploadedBy}</td>
                      <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {doc.description ?? '—'}
                      </td>
                      <td>{formatDateShort(doc.createdAt)}</td>
                      <td>
                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="btn btn--outline btn--sm">
                          View
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ================================================================
          PRD EDITOR + SIGN STATUS
          ================================================================ */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="card-header">
          <h2 className="card-title">PRD (Product Requirements Document)</h2>
        </div>
        <div className="card-body">
          {prdLoading ? (
            <div style={{ textAlign: 'center' }}>
              <div className="spinner" style={{ margin: '0 auto' }} />
            </div>
          ) : (
            <>
              <form onSubmit={handleSavePrd} noValidate>
                <div className="form-group">
                  <label className="form-label" htmlFor="pd-prd">Content (Markdown)</label>
                  <textarea
                    id="pd-prd"
                    className="form-textarea"
                    rows={12}
                    value={prdContent}
                    onChange={(e) => setPrdContent(e.target.value)}
                    placeholder="Write or edit the PRD in markdown..."
                  />
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn btn--primary" disabled={savingPrd}>
                    {savingPrd ? 'Saving...' : 'Save PRD'}
                  </button>
                </div>
              </form>

              {/* Sign-off Status Card */}
              {prd && (
                <div className="card" style={{ marginTop: 'var(--space-6)', border: '1px solid var(--surface-border)', boxShadow: 'none' }}>
                  <div className="card-header">
                    <h2 className="card-title">Sign-off Status</h2>
                    <span className={`badge ${prd.signerNameAdmin ? 'badge--live' : 'badge--unpublished'}`}>
                      {prd.signerNameAdmin ? 'Admin Signed' : 'Not Signed by Admin'}
                    </span>
                  </div>
                  <div className="card-body">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                      <div>
                        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--content-muted)', textTransform: 'uppercase' }}>
                          Customer
                        </span>
                        <p style={{ margin: 'var(--space-1) 0 0' }}>
                          {prd.signerNameCustomer ? (
                            <>
                              Signed by <strong>{prd.signerNameCustomer}</strong>
                              <br />
                              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--content-muted)' }}>
                                {prd.signedAtCustomer ? formatDate(prd.signedAtCustomer) : '—'}
                              </span>
                            </>
                          ) : (
                            <span style={{ color: 'var(--content-muted)' }}>Not yet signed</span>
                          )}
                        </p>
                      </div>
                      <div>
                        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--content-muted)', textTransform: 'uppercase' }}>
                          Admin
                        </span>
                        <p style={{ margin: 'var(--space-1) 0 0' }}>
                          {prd.signerNameAdmin ? (
                            <>
                              Signed by <strong>{prd.signerNameAdmin}</strong>
                              <br />
                              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--content-muted)' }}>
                                {prd.signedAtAdmin ? formatDate(prd.signedAtAdmin) : '—'}
                              </span>
                            </>
                          ) : (
                            <span style={{ color: 'var(--content-muted)' }}>Not yet signed</span>
                          )}
                        </p>
                      </div>
                    </div>
                    {!prd.signerNameAdmin && (
                      <div className="form-actions" style={{ marginTop: 'var(--space-4)' }}>
                        <button
                          type="button"
                          className="btn btn--primary"
                          onClick={handleSignPrd}
                          disabled={signingPrd}
                        >
                          {signingPrd ? 'Signing...' : 'Sign as Admin'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ================================================================
          DEMO
          ================================================================ */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="card-header">
          <h2 className="card-title">Demo</h2>
        </div>
        <div className="card-body">
          {/* Latest Demo Display */}
          {demo && (
            <div style={{ marginBottom: 'var(--space-5)', padding: 'var(--space-4)', background: 'var(--content-bg)', borderRadius: 'var(--surface-radius)' }}>
              <div style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>Latest Demo</div>
              <div className="form-inline" style={{ gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <span className="badge badge--neutral">{demo.type}</span>
                <span style={{ fontSize: 'var(--font-size-sm)', wordBreak: 'break-all' }}>{demo.urlOrAsset}</span>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--content-muted)' }}>
                  {formatDate(demo.createdAt)}
                </span>
              </div>
              {demo.notes && (
                <p style={{ marginTop: 'var(--space-2)', fontSize: 'var(--font-size-sm)', color: 'var(--content-muted)' }}>
                  {demo.notes}
                </p>
              )}
            </div>
          )}

          {/* Add Demo Form */}
          <form onSubmit={handleAddDemo} noValidate>
            <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 'var(--space-3)', alignItems: 'start' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="pd-demo-type">Type</label>
                <select
                  id="pd-demo-type"
                  className={`form-select${demoFieldErrors.type ? ' form-select--error' : ''}`}
                  value={demoForm.type}
                  onChange={(e) => setDemoForm((p) => ({ ...p, type: e.target.value as 'screenshot' | 'url' }))}
                >
                  <option value="screenshot">Screenshot</option>
                  <option value="url">URL</option>
                </select>
                {demoFieldErrors.type && <div className="form-error">{demoFieldErrors.type}</div>}
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="pd-demo-url">URL / Asset</label>
                <input
                  id="pd-demo-url"
                  className={`form-input${demoFieldErrors.urlOrAsset ? ' form-input--error' : ''}`}
                  value={demoForm.urlOrAsset}
                  onChange={(e) => setDemoForm((p) => ({ ...p, urlOrAsset: e.target.value }))}
                  placeholder="https://example.com/demo or asset path"
                  maxLength={2000}
                />
                {demoFieldErrors.urlOrAsset && <div className="form-error">{demoFieldErrors.urlOrAsset}</div>}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="pd-demo-notes">Notes (optional)</label>
              <input
                id="pd-demo-notes"
                className="form-input"
                value={demoForm.notes}
                onChange={(e) => setDemoForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Optional notes about this demo"
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn--primary" disabled={addingDemo}>
                {addingDemo ? 'Adding...' : 'Add Demo'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ================================================================
          INVOICES
          ================================================================ */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="card-header">
          <h2 className="card-title">Invoices</h2>
        </div>
        <div className="card-body">
          {/* Invoice List */}
          {invoices.length > 0 && (
            <div className="table-wrapper" style={{ marginBottom: 'var(--space-5)' }}>
              <table>
                <thead>
                  <tr>
                    <th>Amount</th>
                    <th>Currency</th>
                    <th>Status</th>
                    <th>Notes</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{inv.amount.toLocaleString()}</td>
                      <td>{inv.currency}</td>
                      <td>
                        <span className={`badge ${inv.status === 'paid_cash' ? 'badge--live' : 'badge--warning'}`}>
                          {inv.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {inv.notes ?? '—'}
                      </td>
                      <td>{formatDateShort(inv.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Create Invoice Form */}
          <form onSubmit={handleAddInvoice} noValidate>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 150px', gap: 'var(--space-3)', alignItems: 'start' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="pd-inv-amount">Amount</label>
                <input
                  id="pd-inv-amount"
                  className={`form-input${invoiceFieldErrors.amount ? ' form-input--error' : ''}`}
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={invoiceForm.amount}
                  onChange={(e) => setInvoiceForm((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="0.00"
                />
                {invoiceFieldErrors.amount && <div className="form-error">{invoiceFieldErrors.amount}</div>}
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="pd-inv-currency">Currency</label>
                <select
                  id="pd-inv-currency"
                  className={`form-select${invoiceFieldErrors.currency ? ' form-select--error' : ''}`}
                  value={invoiceForm.currency}
                  onChange={(e) => setInvoiceForm((p) => ({ ...p, currency: e.target.value }))}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                {invoiceFieldErrors.currency && <div className="form-error">{invoiceFieldErrors.currency}</div>}
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="pd-inv-status">Status</label>
                <select
                  id="pd-inv-status"
                  className={`form-select${invoiceFieldErrors.status ? ' form-select--error' : ''}`}
                  value={invoiceForm.status}
                  onChange={(e) => setInvoiceForm((p) => ({ ...p, status: e.target.value as 'unpaid' | 'paid_cash' }))}
                >
                  <option value="unpaid">Unpaid</option>
                  <option value="paid_cash">Paid (Cash)</option>
                </select>
                {invoiceFieldErrors.status && <div className="form-error">{invoiceFieldErrors.status}</div>}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="pd-inv-notes">Notes (optional)</label>
              <input
                id="pd-inv-notes"
                className="form-input"
                value={invoiceForm.notes}
                onChange={(e) => setInvoiceForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Optional notes"
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn--primary" disabled={addingInvoice}>
                {addingInvoice ? 'Creating...' : 'Create Invoice'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ================================================================
          FEEDBACK
          ================================================================ */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="card-header">
          <h2 className="card-title">Customer Feedback</h2>
        </div>
        <div className="card-body">
          {!feedback ? (
            <div className="state-message" style={{ padding: 'var(--space-4)' }}>
              <p>No feedback submitted yet.</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                <div>
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--content-muted)', textTransform: 'uppercase' }}>
                    Rating
                  </span>
                  <p style={{ fontWeight: 600, fontSize: 'var(--font-size-lg)' }}>
                    {'★'.repeat(feedback.rating)}{'☆'.repeat(5 - feedback.rating)}
                  </p>
                </div>
                <div>
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--content-muted)', textTransform: 'uppercase' }}>
                    Status
                  </span>
                  <p>
                    <span className={`badge ${feedback.isPublished ? 'badge--live' : 'badge--unpublished'}`}>
                      {feedback.isPublished ? 'Published' : 'Not Published'}
                    </span>
                    <span className={`badge ${feedback.consentToPublish ? 'badge--live' : 'badge--neutral'}`} style={{ marginLeft: 'var(--space-2)' }}>
                      {feedback.consentToPublish ? 'Consent Given' : 'No Consent'}
                    </span>
                  </p>
                </div>
              </div>
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--content-muted)', textTransform: 'uppercase' }}>
                  Comment
                </span>
                <p style={{ marginTop: 'var(--space-1)', whiteSpace: 'pre-wrap' }}>{feedback.comment}</p>
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--content-muted)', marginBottom: 'var(--space-4)' }}>
                Submitted: {formatDate(feedback.createdAt)}
              </div>
              {!feedback.isPublished && feedback.consentToPublish && (
                <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={handleApproveFeedback}
                    disabled={approvingFeedback}
                  >
                    {approvingFeedback ? 'Approving...' : 'Approve for Publish'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
