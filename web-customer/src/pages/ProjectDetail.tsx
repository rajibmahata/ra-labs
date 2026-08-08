import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, ApiClientError } from '../api/client';
import type {
  ProjectDetail,
  Document,
  Prd,
  Demo,
  Invoice,
  ProjectStatus,
} from '../types';
import StatusBadge from '../components/StatusBadge';
import StarRating from '../components/StarRating';
import LoadingSpinner from '../components/LoadingSpinner';

const STATUS_ORDER: ProjectStatus[] = [
  'intake',
  'prd_draft',
  'prd_signed',
  'in_build',
  'demo',
  'delivered',
  'closed',
];

const STATUS_LABELS: Record<ProjectStatus, string> = {
  intake: 'Intake',
  prd_draft: 'PRD',
  prd_signed: 'PRD\nSigned',
  in_build: 'Build',
  demo: 'Demo',
  delivered: 'Done',
  closed: 'Closed',
};

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [prd, setPrd] = useState<Prd | null>(null);
  const [demo, setDemo] = useState<Demo | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Sign PRD
  const [signName, setSignName] = useState('');
  const [signError, setSignError] = useState('');
  const [signing, setSigning] = useState(false);

  // Upload
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Feedback
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [consentToPublish, setConsentToPublish] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [projectRes, docsRes, prdRes, demoRes, invoicesRes] =
        await Promise.all([
          api.getProject(id),
          api.getDocuments(id),
          api.getPrd(id).catch(() => ({ data: null as Prd | null })),
          api.getDemo(id).catch(() => ({ data: null as Demo | null })),
          api.getInvoices(id).catch(() => ({ data: [] as Invoice[] })),
        ]);

      setProject(projectRes.data);
      setDocuments(docsRes.data);
      setPrd(prdRes.data);
      setDemo(demoRes.data);
      setInvoices(invoicesRes.data);
    } catch (err) {
      const msg =
        err instanceof ApiClientError ? err.message : 'Failed to load project.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSignPrd = async (e: FormEvent) => {
    e.preventDefault();
    if (!id || !signName.trim()) return;
    setSigning(true);
    setSignError('');
    try {
      const res = await api.signPrd(id, { confirmName: signName.trim() });
      setPrd(res.data);
      setSignName('');
    } catch (err) {
      setSignError(
        err instanceof ApiClientError ? err.message : 'Failed to sign PRD.'
      );
    } finally {
      setSigning(false);
    }
  };

  const handleUpload = async () => {
    if (!id || !uploadFile) return;
    setUploading(true);
    setUploadError('');
    try {
      const res = await api.uploadDocument(id, uploadFile);
      setDocuments((prev) => [...prev, res.data]);
      setUploadFile(null);
      // Reset file input
      const fileInput = document.getElementById(
        'file-upload-input'
      ) as HTMLInputElement | null;
      if (fileInput) fileInput.value = '';
    } catch (err) {
      setUploadError(
        err instanceof ApiClientError ? err.message : 'Upload failed.'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleSubmitFeedback = async (e: FormEvent) => {
    e.preventDefault();
    if (!id || rating < 1 || rating > 5) {
      setFeedbackError('Please select a rating between 1 and 5.');
      return;
    }
    setSubmittingFeedback(true);
    setFeedbackError('');
    setFeedbackSuccess(false);
    try {
      await api.submitFeedback(id, {
        rating,
        comment: comment.trim(),
        consentToPublish,
      });
      setFeedbackSuccess(true);
      setRating(0);
      setComment('');
      setConsentToPublish(false);
    } catch (err) {
      setFeedbackError(
        err instanceof ApiClientError ? err.message : 'Failed to submit feedback.'
      );
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const canSubmitFeedback =
    project?.status === 'delivered' || project?.status === 'closed';

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error || !project) {
    return (
      <div className="project-detail">
        <Link to="/dashboard" className="back-link">
          ← Back to Dashboard
        </Link>
        <div className="state-placeholder" role="alert">
          <h3>Error</h3>
          <p>{error || 'Project not found.'}</p>
          <button className="btn btn-primary" onClick={loadData} style={{ marginTop: 16 }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const currentIndex = STATUS_ORDER.indexOf(project.status);

  return (
    <div className="project-detail">
      <Link to="/dashboard" className="back-link">
        ← Back to Dashboard
      </Link>

      <div className="project-detail-header">
        <div>
          <h1>{project.title}</h1>
          <div className="meta-row">
            <StatusBadge status={project.status} />
            <span style={{ fontSize: 13, color: 'var(--ink-dim)' }}>
              Created{' '}
              {new Date(project.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>
        </div>
        <Link
          to={`/projects/${project.id}/chat`}
          className="btn btn-secondary"
        >
          💬 Chat Thread
        </Link>
      </div>

      <section className="detail-section project-brief" aria-labelledby="project-brief-heading">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Project context</span>
            <h2 id="project-brief-heading">Your brief</h2>
          </div>
          <span className="section-note">Shared with the R&amp;A Labs team</span>
        </div>
        <div className="brief-grid">
          <div className="brief-item brief-item-wide">
            <span className="brief-label">Goal</span>
            <p>{project.goal || 'No goal provided.'}</p>
          </div>
          {project.audience && <div className="brief-item"><span className="brief-label">Audience</span><p>{project.audience}</p></div>}
          {project.timeline && <div className="brief-item"><span className="brief-label">Timeline</span><p>{project.timeline}</p></div>}
          {project.requirements && <div className="brief-item brief-item-wide"><span className="brief-label">Requirements</span><p>{project.requirements}</p></div>}
          {project.budgetOrConstraints && <div className="brief-item"><span className="brief-label">Budget or constraints</span><p>{project.budgetOrConstraints}</p></div>}
          {project.referenceLinks && <div className="brief-item"><span className="brief-label">References</span><p>{project.referenceLinks}</p></div>}
        </div>
        <p className="brief-followup">Use the project chat to clarify details, respond to questions, and shape the next PRD step.</p>
      </section>

      {/* Status Timeline */}
      <div className="status-timeline" aria-label="Project status timeline">
        {STATUS_ORDER.map((status, idx) => {
          const isPast = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          return (
            <div
              key={status}
              className={`timeline-step${isCurrent ? ' current' : ''}${
                isPast ? ' past' : ''
              }`}
            >
              <div className="circle" aria-hidden="true" />
              <span className="label">
                {STATUS_LABELS[status].split('\n').map((line, i) => (
                  <span key={i}>
                    {line}
                    {i === 0 && STATUS_LABELS[status].includes('\n') ? <br /> : null}
                  </span>
                ))}
              </span>
            </div>
          );
        })}
      </div>

      {/* Admin Notes */}
      {project.adminNotes && (
        <div className="section">
          <h2 className="section-title">Admin Notes</h2>
          <div className="prd-content">{project.adminNotes}</div>
        </div>
      )}

      {/* Documents Section */}
      <div className="section">
        <h2 className="section-title">
          Documents ({documents.length})
        </h2>
        {documents.length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--ink-dim)' }}>
            No documents uploaded yet.
          </p>
        ) : (
          <div className="doc-list">
            {documents.map((doc) => (
              <div key={doc.id} className="doc-item">
                <div className="doc-info">
                  <span className="doc-name">{doc.fileName}</span>
                  <span className="doc-meta">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <a
                  href={doc.fileUrl}
                  className="doc-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Download
                </a>
              </div>
            ))}
          </div>
        )}

        <div className="upload-row">
          <input
            id="file-upload-input"
            type="file"
            name="file"
            onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
            aria-label="Choose file to upload"
          />
          <button
            className="btn btn-primary btn-small"
            onClick={handleUpload}
            disabled={!uploadFile || uploading}
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
        {uploadError && (
          <p className="form-error" role="alert" style={{ marginTop: 8 }}>
            {uploadError}
          </p>
        )}
      </div>

      {/* PRD Section */}
      <div className="section">
        <h2 className="section-title">PRD</h2>
        {prd ? (
          <>
            <div className="prd-content">{prd.content || 'No PRD content yet.'}</div>

            <div className="prd-signatures">
              {prd.signerNameCustomer && (
                <div className="signature-box">
                  <div className="sig-label">Customer</div>
                  <div className="sig-value">{prd.signerNameCustomer}</div>
                  {prd.signedAtCustomer && (
                    <div className="sig-value" style={{ marginTop: 4 }}>
                      {new Date(prd.signedAtCustomer).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  )}
                </div>
              )}
              {prd.signerNameAdmin && (
                <div className="signature-box">
                  <div className="sig-label">Admin</div>
                  <div className="sig-value">{prd.signerNameAdmin}</div>
                  {prd.signedAtAdmin && (
                    <div className="sig-value" style={{ marginTop: 4 }}>
                      {new Date(prd.signedAtAdmin).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {!prd.signerNameCustomer && (
              <form
                onSubmit={handleSignPrd}
                style={{
                  marginTop: 20,
                  padding: 20,
                  background: 'var(--surface-tint)',
                  borderRadius: 'var(--radius)',
                }}
              >
                <h3
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    fontFamily: 'var(--font-body)',
                    marginBottom: 12,
                  }}
                >
                  Sign the PRD
                </h3>
                {signError && (
                  <div className="error-banner" role="alert">
                    {signError}
                  </div>
                )}
                <div className="form-group">
                  <label htmlFor="sign-name">
                    Type your full name to confirm
                  </label>
                  <input
                    id="sign-name"
                    type="text"
                    placeholder="Your registered name"
                    value={signName}
                    onChange={(e) => setSignName(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={signing || !signName.trim()}
                >
                  {signing ? 'Signing...' : 'Sign PRD'}
                </button>
              </form>
            )}
          </>
        ) : (
          <p style={{ fontSize: 14, color: 'var(--ink-dim)' }}>
            No PRD available yet.
          </p>
        )}
      </div>

      {/* Demo Section */}
      <div className="section">
        <h2 className="section-title">Demo</h2>
        {demo ? (
          <div className="demo-card card">
            {demo.urlOrAsset && (
              <a
                href={demo.urlOrAsset}
                className="demo-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                View Demo
              </a>
            )}
            {demo.notes && (
              <p style={{ fontSize: 13, color: 'var(--ink-dim)' }}>
                {demo.notes}
              </p>
            )}
            <span className="demo-meta">
              Shared{' '}
              {new Date(demo.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>
        ) : (
          <p style={{ fontSize: 14, color: 'var(--ink-dim)' }}>
            No demo available yet.
          </p>
        )}
      </div>

      {/* Invoices Section */}
      <div className="section">
        <h2 className="section-title">
          Invoices ({invoices.length})
        </h2>
        {invoices.length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--ink-dim)' }}>
            No invoices yet.
          </p>
        ) : (
          <div className="invoice-list">
            {invoices.map((inv, idx) => (
              <div key={idx} className="invoice-item">
                <div>
                  <span className="amount">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: inv.currency || 'USD',
                    }).format(inv.amount)}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: 'var(--ink-dim)',
                      marginLeft: 12,
                    }}
                  >
                    {inv.status}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--ink-dim)' }}>
                  {inv.notes}
                  {inv.notes ? ' · ' : ''}
                  {new Date(inv.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Feedback Form */}
      {canSubmitFeedback && (
        <div className="section">
          <h2 className="section-title">Feedback</h2>
          {feedbackSuccess ? (
            <div className="success-banner" role="status">
              Thank you for your feedback!
            </div>
          ) : (
            <form className="feedback-form" onSubmit={handleSubmitFeedback}>
              {feedbackError && (
                <div className="error-banner" role="alert">
                  {feedbackError}
                </div>
              )}
              <div className="form-group">
                <label id="rating-label">Rating</label>
                <StarRating
                  value={rating}
                  onChange={setRating}
                  disabled={submittingFeedback}
                />
              </div>
              <div className="form-group">
                <label htmlFor="feedback-comment">Comment (optional)</label>
                <textarea
                  id="feedback-comment"
                  placeholder="Share your thoughts..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="checkbox-group">
                <input
                  id="consent-publish"
                  type="checkbox"
                  checked={consentToPublish}
                  onChange={(e) => setConsentToPublish(e.target.checked)}
                />
                <label htmlFor="consent-publish">
                  I consent to R&A Labs publishing this feedback publicly.
                </label>
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submittingFeedback || rating < 1}
                style={{ marginTop: 16 }}
              >
                {submittingFeedback ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
