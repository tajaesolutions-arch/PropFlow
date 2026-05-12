import React from 'react';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  KeyRound,
  Lock,
  ShieldCheck,
} from 'lucide-react';

import { getPostLoginPath } from '../lib/auth.js';
import { useApp } from '../lib/AppContext.jsx';
import { navigate } from '../routes/AppRouter.jsx';

function validateLogin(email, password) {
  const errors = [];

  if (!email.trim()) errors.push('Email is required.');
  if (!password) errors.push('Password is required.');

  return errors;
}

export function LoginPage() {
  const { signIn, isSupabaseConfigured } = useApp();

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [errors, setErrors] = React.useState([]);
  const [busy, setBusy] = React.useState(false);

  const submit = async (event) => {
    event.preventDefault();

    const nextErrors = validateLogin(email, password);
    setErrors(nextErrors);

    if (nextErrors.length) {
      setMessage('Please enter your login details.');
      return;
    }

    if (!isSupabaseConfigured) {
      setMessage(
        'Authentication is not connected for this deployment yet. Ask a workspace owner or PropFlow support to finish setup.',
      );
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      const result = await signIn(email.trim(), password);
      const nextUser = result?.accountState?.currentUser;

      if (!nextUser) {
        setMessage(
          'Login succeeded, but your workspace profile did not finish loading. Refresh the page or check your Supabase workspace membership record.',
        );
        return;
      }

      navigate(getPostLoginPath(nextUser));
    } catch (error) {
      setMessage(error.message || 'Login failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page login-page">
      <section className="auth-card login-card">
        <div className="login-card-header">
          <div className="login-logo">
            <ShieldCheck size={28} />
          </div>

          <div>
            <p className="eyebrow">Secure workspace login</p>
            <h1>Login to PropFlow</h1>
            <p>
              Use your real Supabase Auth account. PropFlow loads your workspace, roles, and
              dashboard access from the database after login.
            </p>
          </div>
        </div>

        {!isSupabaseConfigured && (
          <div className="helper error-helper">
            <Lock size={16} />
            Authentication is not connected for this deployment yet. Demo login is not available in production.
          </div>
        )}

        {errors.length > 0 && (
          <div className="helper error-helper" role="alert">
            <strong>Please fix these fields:</strong>
            <ul>
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {message && (
          <div
            className={
              message.toLowerCase().includes('succeeded') ? 'helper' : 'helper error-helper'
            }
            role="status"
          >
            {message}
          </div>
        )}

        <form className="login-form" onSubmit={submit} noValidate>
          <label>
            Email
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              type="email"
              autoComplete="email"
              required
            />
          </label>

          <label>
            Password
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </label>

          <button className="primary login-submit" disabled={busy}>
            {busy ? 'Authenticating…' : 'Login'}
            {!busy && <ArrowRight size={16} />}
          </button>
        </form>

        <div className="login-links">
          <button type="button" className="link" onClick={() => navigate('/signup')}>
            Create account
          </button>

          <span>·</span>

          <button type="button" className="link" onClick={() => navigate('/join')}>
            I have an invite or code
          </button>
        </div>

        <div className="login-security-grid">
          <span>
            <KeyRound size={16} />
            <strong>Role-based routing</strong>
            <small>Users are routed by saved database role.</small>
          </span>

          <span>
            <Building2 size={16} />
            <strong>Workspace scoped</strong>
            <small>Each company keeps its records separated.</small>
          </span>

          <span>
            <CheckCircle2 size={16} />
            <strong>No demo login</strong>
            <small>Production UI uses real authentication only.</small>
          </span>
        </div>
      </section>
    </div>
  );
}
