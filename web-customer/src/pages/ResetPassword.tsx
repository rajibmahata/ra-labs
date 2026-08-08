import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiClientError } from '../api/client';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token') ?? '';
  const emailFromUrl = searchParams.get('email') ?? '';

  const [email, setEmail] = useState(emailFromUrl);
  const [token, setToken] = useState(tokenFromUrl);
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!email.trim()) {
      errors.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Enter a valid email address.';
    }
    if (!token.trim()) {
      errors.token = 'Reset token is required.';
    }
    if (!newPassword) {
      errors.newPassword = 'New password is required.';
    } else if (newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    if (!validate()) return;

    setLoading(true);
    try {
      await api.resetPassword({
        email: email.trim(),
        token: token.trim(),
        newPassword,
      });
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Reset failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Reset password</h1>
        <p className="subtitle">Enter your new password.</p>

        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
        {success && (
          <div className="success-banner" role="status">
            Password reset successfully.{' '}
            <Link to="/login" style={{ fontWeight: 600 }}>
              Log in
            </Link>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="reset-email">Email</label>
            <input
              id="reset-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? 'reset-email-error' : undefined}
            />
            {fieldErrors.email && (
              <span id="reset-email-error" className="form-error" role="alert">
                {fieldErrors.email}
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="reset-token">Reset Token</label>
            <input
              id="reset-token"
              type="text"
              placeholder="Paste your reset token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              aria-invalid={!!fieldErrors.token}
              aria-describedby={fieldErrors.token ? 'reset-token-error' : undefined}
            />
            {fieldErrors.token && (
              <span id="reset-token-error" className="form-error" role="alert">
                {fieldErrors.token}
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="reset-password">New Password</label>
            <input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              aria-invalid={!!fieldErrors.newPassword}
              aria-describedby={fieldErrors.newPassword ? 'reset-newPassword-error' : undefined}
            />
            <span className="form-helper">Minimum 8 characters</span>
            {fieldErrors.newPassword && (
              <span id="reset-newPassword-error" className="form-error" role="alert">
                {fieldErrors.newPassword}
              </span>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary full-width"
            disabled={loading}
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>

        <div className="auth-links">
          <Link to="/login">Back to login</Link>
        </div>
      </div>
    </div>
  );
}
