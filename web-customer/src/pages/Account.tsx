import { useAuth } from '../context/AuthContext';

export default function Account() {
  const { user } = useAuth();

  return (
    <div className="account-page">
      <h1>Account</h1>
      <div className="card account-card">
        <div className="account-field">
          <span className="field-label">Name</span>
          <span className="field-value">{user?.name ?? '—'}</span>
        </div>
        <div className="account-field">
          <span className="field-label">Email</span>
          <span className="field-value">{user?.email ?? '—'}</span>
        </div>
      </div>
    </div>
  );
}
