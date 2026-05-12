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

function friendlyAuthMessage(message, fallback) {
  const text = String(message || '').trim();

  if (!text) return fallback;

  const lower = text.toLowerCase();
  if (lower.includes('invalid') || lower.includes('credentials')) {
    return 'The email or password is incorrect. Check your details and try again.';
  }

  if (lower.includes('email') && lower.includes('confirm')) {
    return 'Please confirm your email address before logging in.';
  }

  return fallback;
}

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
        'Login is not available in this deployment yet. Ask a workspace owner or PropFlow support to finish setup.',
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
          'Login succeeded, but your workspace profile did not finish loading. Refresh the page or contact your workspace owner if this continues.',
        );
        return;
      }

      navigate(getPostLoginPath(nextUser));
    } catch (error) {
      setMessage(friendlyAuthMessage(error.message, 'We could not log you in. Check your details and try again.'));
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
              Use your PropFlow account. We will send you to the right workspace and dashboard
              based on your saved role after login.
            </p>
          </div>
        </div>

        {!isSupabaseConfigured && (
          <div className="helper error-helper">
            <Lock size={16} />
            Login is not available in this deployment yet. Ask your workspace owner or PropFlow support for help.
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
