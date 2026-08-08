import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { team as teamApi, ApiClientError } from '../api/client';
import { useToast } from '../components/useToast';


export default function MyProfile() {
  const { teamProfile, refreshTeamProfile } = useAuth();
  const { addToast, ToastContainer } = useToast();
  const [form, setForm] = useState({
    name: '',
    role: '',
    bio: '',
    githubUsername: '',
    avatarUrl: '',
    email: '',
    linkedinUrl: '',
    location: '',
    isPublished: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (teamProfile) {
      setForm({
        name: teamProfile.name,
        role: teamProfile.role,
        bio: teamProfile.bio,
        githubUsername: teamProfile.githubUsername ?? '',
        avatarUrl: teamProfile.avatarUrl ?? '',
        email: teamProfile.email ?? '',
        linkedinUrl: teamProfile.linkedinUrl ?? '',
        location: teamProfile.location ?? '',
        isPublished: teamProfile.isPublished,
      });
      setLoading(false);
    } else {
      setError('No team profile found. You may not be linked to a team member yet. Contact an admin.');
      setLoading(false);
    }
  }, [teamProfile]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    else if (form.name.length > 100) errs.name = 'Name must be 100 characters or fewer';
    if (!form.role.trim()) errs.role = 'Role is required';
    if (!form.bio.trim()) errs.bio = 'Bio is required';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        role: form.role.trim(),
        bio: form.bio.trim(),
        githubUsername: form.githubUsername || null,
        avatarUrl: form.avatarUrl || null,
        email: form.email || null,
        linkedinUrl: form.linkedinUrl || null,
        location: form.location || null,
        isPublished: form.isPublished,
      };
      await teamApi.updateMe(payload);
      await refreshTeamProfile();
      addToast('Profile updated successfully', 'success');
    } catch (e) {
      if (e instanceof ApiClientError) {
        setError(e.message);
      } else {
        setError('Failed to update profile');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-loader">
        <div className="spinner" />
        <p>Loading your profile...</p>
      </div>
    );
  }

  if (error && !teamProfile) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">My Profile</h1>
        </div>
        <div className="state-message">
          <span className="state-message-icon">👤</span>
          <h3>No Team Profile Linked</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const snapshot = teamProfile?.githubSnapshot;

  return (
    <div>
      <ToastContainer />
      <div className="page-header">
        <div>
          <h1 className="page-title">My Profile</h1>
          <p className="page-subtitle">
            Update your public team profile. Changes appear on the public site immediately.
            {snapshot && (
              <span style={{ marginLeft: '16px', fontSize: 'var(--font-size-xs)', color: 'var(--content-muted)' }}>
                GitHub: {snapshot.commits90d} commits in the last 90 days · Last commit: {new Date(snapshot.lastCommitAt).toLocaleDateString()}
              </span>
            )}
          </p>
        </div>
      </div>

      {error && <div className="alert alert--error" role="alert">{error}</div>}
      {fieldErrors._form && <div className="alert alert--error" role="alert">{fieldErrors._form}</div>}

      <div className="card">
        <div className="card-body">
          <form onSubmit={handleSubmit} noValidate>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="pf-name">Name *</label>
                <input
                  id="pf-name"
                  className={`form-input${fieldErrors.name ? ' form-input--error' : ''}`}
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  maxLength={100}
                />
                {fieldErrors.name && <div className="form-error">{fieldErrors.name}</div>}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="pf-role">Role *</label>
                <input
                  id="pf-role"
                  className={`form-input${fieldErrors.role ? ' form-input--error' : ''}`}
                  value={form.role}
                  onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                  maxLength={100}
                />
                {fieldErrors.role && <div className="form-error">{fieldErrors.role}</div>}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="pf-bio">Bio *</label>
              <textarea
                id="pf-bio"
                className={`form-textarea${fieldErrors.bio ? ' form-textarea--error' : ''}`}
                value={form.bio}
                onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
                rows={4}
              />
              {fieldErrors.bio && <div className="form-error">{fieldErrors.bio}</div>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="pf-gh">GitHub Username</label>
                <input id="pf-gh" className="form-input" value={form.githubUsername} onChange={(e) => setForm((p) => ({ ...p, githubUsername: e.target.value }))} maxLength={100} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="pf-email">Email</label>
                <input id="pf-email" className="form-input" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="pf-li">LinkedIn URL</label>
                <input id="pf-li" className="form-input" value={form.linkedinUrl} onChange={(e) => setForm((p) => ({ ...p, linkedinUrl: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="pf-loc">Location</label>
                <input id="pf-loc" className="form-input" value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="pf-avatar">Avatar URL</label>
              <input id="pf-avatar" className="form-input" value={form.avatarUrl} onChange={(e) => setForm((p) => ({ ...p, avatarUrl: e.target.value }))} maxLength={500} />
            </div>
            <div className="form-group" style={{ paddingTop: '8px' }}>
              <label className="form-checkbox">
                <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm((p) => ({ ...p, isPublished: e.target.checked }))} />
                Show my profile on the public site
              </label>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {snapshot && (
        <div className="card" style={{ marginTop: 'var(--space-4)' }}>
          <div className="card-header">
            <h2 className="card-title">GitHub Activity Snapshot</h2>
          </div>
          <div className="card-body">
            <div className="stat-grid" style={{ marginBottom: 0 }}>
              <div className="stat-card">
                <span className="stat-card-label">Commits (90 days)</span>
                <span className="stat-card-value">{snapshot.commits90d}</span>
              </div>
              <div className="stat-card">
                <span className="stat-card-label">Active Repos</span>
                <span className="stat-card-value">{snapshot.activeRepos}</span>
              </div>
              <div className="stat-card">
                <span className="stat-card-label">Last Commit</span>
                <span className="stat-card-value" style={{ fontSize: 'var(--font-size-md)' }}>
                  {new Date(snapshot.lastCommitAt).toLocaleDateString()}
                </span>
              </div>
              <div className="stat-card">
                <span className="stat-card-label">Snapshot Captured</span>
                <span className="stat-card-value" style={{ fontSize: 'var(--font-size-xs)' }}>
                  {new Date(snapshot.capturedAt).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
