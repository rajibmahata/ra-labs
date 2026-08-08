import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiClientError } from '../api/client';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [fieldError, setFieldError] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = (): boolean => {
    if (!email.trim()) {
      setFieldError('Email is required.');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldError('Enter a valid email address.');
      return false;
    }
    setFieldError('');
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    if (!validate()) return;

    setLoading(true);
    try {
      await api.forgotPassword({ email: email.trim() });
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Request failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Forgot password</h1>
        <p className="subtitle">
          Enter your email and we&apos;ll send you a reset link.
        </p>

        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
        {success && (
          <div className="success-banner" role="status">
            If that email is registered, we&apos;ve sent password reset instructions.
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="forgot-email">Email</label>
            <input
              id="forgot-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!fieldError}
              aria-describedby={fieldError ? 'forgot-email-error' : undefined}
            />
            {fieldError && (
              <span id="forgot-email-error" className="form-error" role="alert">
                {fieldError}
              </span>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary full-width"
            disabled={loading}
          >
            {loading ? 'Sending...' : 'Send Reset Instructions'}
          </button>
        </form>

        <div className="auth-links">
          <Link to="/login">Back to login</Link>
        </div>
      </div>
    </div>
  );
}
