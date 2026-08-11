import { useState, useEffect, type FormEvent } from 'react';
import { admins as adminsApi, team as teamApi, settings as settingsApi, ApiClientError } from '../api/client';
import { InlineConfirm } from '../components/InlineConfirm';
import { useToast } from '../components/useToast';
import type { AdminEntry, TeamMember } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface AiVoiceSettings {
  'ai.voice.enabled': string;
  'ai.voice.response': string;
  'ai.streaming.enabled': string;
  'ai.chat.model': string;
  'ai.stt.provider': string;
  'ai.tts.provider': string;
  'ai.max.audio.duration': string;
}

const EMPTY_AI_VOICE: AiVoiceSettings = {
  'ai.voice.enabled': 'false',
  'ai.voice.response': 'false',
  'ai.streaming.enabled': 'false',
  'ai.chat.model': 'gpt-4o-mini',
  'ai.stt.provider': '',
  'ai.tts.provider': '',
  'ai.max.audio.duration': '60',
};

export default function Settings() {
  const { user } = useAuth();
  const { addToast, ToastContainer } = useToast();
  const [admins, setAdmins] = useState<AdminEntry[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', teamMemberId: '', role: 'admin' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [aiVoice, setAiVoice] = useState<AiVoiceSettings>(EMPTY_AI_VOICE);
  const [aiLoading, setAiLoading] = useState(true);
  const [aiSaving, setAiSaving] = useState(false);
  const isSuper = user?.role === 'super_admin';

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [adminsRes, teamRes] = await Promise.all([
        adminsApi.list(),
        teamApi.list(),
      ]);
      setAdmins(adminsRes.data as AdminEntry[]);
      setTeamMembers(teamRes.data as TeamMember[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchAiVoice = async () => {
    setAiLoading(true);
    try {
      const res = await settingsApi.get();
      setAiVoice({ ...EMPTY_AI_VOICE, ...res.data });
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 403) {
        // Regular admins cannot read settings; hide the section.
        setAiVoice(EMPTY_AI_VOICE);
      } else {
        addToast(e instanceof Error ? e.message : 'Failed to load AI & Voice settings', 'error');
      }
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (isSuper) fetchAiVoice();
    else setAiLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuper]);

  const saveAiVoice = async (e: FormEvent) => {
    e.preventDefault();
    setAiSaving(true);
    try {
      await settingsApi.update({ ...aiVoice });
      addToast('AI & Voice settings saved', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to save settings', 'error');
    } finally {
      setAiSaving(false);
    }
  };

  const openCreate = () => {
    setForm({ name: '', email: '', password: '', teamMemberId: '', role: 'admin' });
    setFieldErrors({});
    setCreateOpen(true);
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email address';
    if (!form.password) errs.password = 'Password is required';
    else if (form.password.length < 8) errs.password = 'Password must be at least 8 characters';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await adminsApi.create({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        teamMemberId: form.teamMemberId || null,
        role: isSuper ? form.role : 'admin',
      });
      addToast('Admin account created', 'success');
      setCreateOpen(false);
      fetchData();
    } catch (e) {
      if (e instanceof ApiClientError) {
        if (e.code === 'CONFLICT') {
          setFieldErrors((prev) => ({ ...prev, email: 'An admin with this email already exists' }));
        } else {
          addToast(e.message, 'error');
        }
      } else {
        addToast('Failed to create admin', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const getTeamMemberName = (id: string | null | undefined): string => {
    if (!id) return '—';
    const member = teamMembers.find((m) => m.id === id);
    return member ? member.name : 'Unknown';
  };

  const handleStatus = async (admin: AdminEntry) => {
    try {
      await adminsApi.setStatus(admin.id, !admin.isActive);
      addToast(admin.isActive ? 'Admin account deactivated' : 'Admin account activated', 'success');
      await fetchData();
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Failed to update admin account', 'error');
    }
  };

  return (
    <div>
      <ToastContainer />
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage admin accounts and platform configuration.</p>
        </div>
        <button className="btn btn--primary" onClick={openCreate}>Add Admin</button>
      </div>

      {error && <div className="alert alert--error" role="alert">{error}</div>}

      {isSuper && (
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <div className="card-header">
            <h2 className="card-title">AI &amp; Voice</h2>
          </div>
          <div className="card-body">
            {aiLoading ? (
              <div className="page-loader"><div className="spinner" /></div>
            ) : (
              <form onSubmit={saveAiVoice} noValidate>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Voice input (STT)</label>
                    <select className="form-select" value={aiVoice['ai.voice.enabled']} onChange={(e) => setAiVoice((p) => ({ ...p, 'ai.voice.enabled': e.target.value }))}>
                      <option value="false">Off</option>
                      <option value="true">On</option>
                    </select>
                    <div className="form-hint">Shows the microphone on the public and customer AI Agent pages.</div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Voice responses (TTS)</label>
                    <select className="form-select" value={aiVoice['ai.voice.response']} onChange={(e) => setAiVoice((p) => ({ ...p, 'ai.voice.response': e.target.value }))}>
                      <option value="false">Off</option>
                      <option value="true">On</option>
                    </select>
                    <div className="form-hint">The agent reads its replies aloud when voice is on.</div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Response streaming</label>
                    <select className="form-select" value={aiVoice['ai.streaming.enabled']} onChange={(e) => setAiVoice((p) => ({ ...p, 'ai.streaming.enabled': e.target.value }))}>
                      <option value="false">Off</option>
                      <option value="true">On</option>
                    </select>
                    <div className="form-hint">Streams AI responses when an AI provider is configured. Without a provider key the agent answers instantly from knowledge.</div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Chat model</label>
                    <input className="form-input" value={aiVoice['ai.chat.model']} onChange={(e) => setAiVoice((p) => ({ ...p, 'ai.chat.model': e.target.value }))} maxLength={100} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Speech-to-text provider</label>
                    <input className="form-input" value={aiVoice['ai.stt.provider']} onChange={(e) => setAiVoice((p) => ({ ...p, 'ai.stt.provider': e.target.value }))} placeholder="e.g. browser-web-speech" maxLength={100} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Text-to-speech provider</label>
                    <input className="form-input" value={aiVoice['ai.tts.provider']} onChange={(e) => setAiVoice((p) => ({ ...p, 'ai.tts.provider': e.target.value }))} placeholder="e.g. browser-speech-synthesis" maxLength={100} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Max audio duration (seconds)</label>
                    <input className="form-input" type="number" min={5} max={300} value={aiVoice['ai.max.audio.duration']} onChange={(e) => setAiVoice((p) => ({ ...p, 'ai.max.audio.duration': e.target.value }))} />
                  </div>
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn btn--primary" disabled={aiSaving}>
                    {aiSaving ? 'Saving...' : 'Save AI & Voice settings'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {createOpen && (
        <div className="card inline-edit-panel" role="region" aria-label="Add admin account">
          <form onSubmit={handleSubmit} noValidate>
            <div className="inline-edit-panel-title">
              <h2 className="page-title">Add Admin</h2>
            </div>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className={`form-input${fieldErrors.name ? ' form-input--error' : ''}`} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} maxLength={100} />
              {fieldErrors.name && <div className="form-error">{fieldErrors.name}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input className={`form-input${fieldErrors.email ? ' form-input--error' : ''}`} type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} maxLength={200} />
              {fieldErrors.email && <div className="form-error">{fieldErrors.email}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Password *</label>
              <input className={`form-input${fieldErrors.password ? ' form-input--error' : ''}`} type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} placeholder="Min 8 characters" />
              {fieldErrors.password && <div className="form-error">{fieldErrors.password}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Link to Team Member (optional)</label>
              <select className="form-select" value={form.teamMemberId} onChange={(e) => setForm((p) => ({ ...p, teamMemberId: e.target.value }))}>
                <option value="">None</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} — {m.role}</option>
                ))}
              </select>
              <div className="form-hint">Linking an admin to a team member enables their "My Profile" self-service updates.</div>
            </div>
            {isSuper && (
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="form-select" value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
                <div className="form-hint">Super admins can manage settings and view the audit log.</div>
              </div>
            )}
            <div className="form-actions">
              <button type="button" className="btn btn--outline" onClick={() => setCreateOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? 'Creating...' : 'Create Admin'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="card-header">
          <h2 className="card-title">Admin Accounts</h2>
        </div>
        <div className="card-body card-body--flush">
          {loading ? (
            <div className="page-loader"><div className="spinner" /></div>
          ) : admins.length === 0 ? (
            <div className="state-message">
              <span className="state-message-icon">⚙️</span>
              <h3>No admin accounts</h3>
              <p>Create admin accounts to grant access to this dashboard.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Team Member</th>
                    <th>Created</th>
                    {user?.role === 'super_admin' && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {admins.map((a) => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 600 }}>{a.name}</td>
                      <td>{a.email}</td>
                      <td><span className="badge">{a.role === 'super_admin' ? 'Super admin' : 'Admin'}</span></td>
                      <td><span className={`badge ${a.isActive ? 'badge--success' : 'badge--muted'}`}>{a.isActive ? 'Active' : 'Inactive'}</span></td>
                      <td>{getTeamMemberName(a.teamMemberId)}</td>
                      <td>{a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '—'}</td>
                      {user?.role === 'super_admin' && <td>
                        <InlineConfirm
                          onConfirm={() => handleStatus(a)}
                          buttonLabel={a.isActive ? 'Deactivate' : 'Activate'}
                          confirmLabel={a.isActive ? 'Deactivate' : 'Activate'}
                          className="btn btn--sm btn--outline"
                        />
                      </td>}
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
