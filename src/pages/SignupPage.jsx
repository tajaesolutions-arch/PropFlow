import React from 'react';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  KeyRound,
  Lock,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';

import { useApp } from '../lib/AppContext.jsx';
import { navigate } from '../routes/AppRouter.jsx';

function validateSignup(form) {
  const errors = [];

  if (!form.fullName.trim()) errors.push('Full name is required.');
  if (!form.email.trim()) errors.push('Email is required.');
  if (!form.password) errors.push('Password is required.');
  if (form.password && form.password.length < 8) errors.push('Password must be at least 8 characters.');

  return errors;
}

export function SignupPage() {
  const { signUp, isSupabaseConfigured } = useApp();

  const [form, setForm] = React.useState({
    fullName: '',
    email: '',
    password: '',
  });

  const [message, setMessage] = React.useState('');
  const [errors, setErrors] = React.useState([]);
  const [busy, setBusy] = React.useState(false);

  const set = (key) => (event) => {
    setForm((value) => ({
      ...value,
      [key]: event.target.value,
    }));
  };

  const submit = async (event) => {
    event.preventDefault();

    const nextErrors = validateSignup(form);
    setErrors(nextErrors);

    if (nextErrors.length) {
      setMessage('Please fix the signup details before continuing.');
      return;
    }

    if (!isSupabaseConfigured) {
      setMessage('Supabase is not configured. Add env vars before creating real accounts.');
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      const authData = await signUp({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        password: form.password,
      });

      if (authData?.session) {
        setMessage('Account created. Continue by creating or joining a workspace.');
        navigate('/workspace-setup');
        return;
      }

      setMessage(
        'Account created. Check your email to confirm your account, then log in to continue workspace setup.',
      );
    } catch (error) {
      setMessage(error.message || 'Signup failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page signup-page">
      <section className="auth-card signup-card">
        <div className="signup-card-header">
          <div className="signup-logo">
            <UserPlus size={28} />
          </div>

          <div>
            <p className="eyebrow">Create your PropFlow account</p>
            <h1>Start your workspace setup.</h1>
            <p>
              Create your user account first. After signup, you can create a new workspace or join an
              existing workspace with a valid invite link or company code.
            </p>
          </div>
        </div>

        {!isSupabaseConfigured && (
          <div className="helper error-helper">
            <Lock size={16} />
            Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before
            creating real accounts.
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
              message.toLowerCase().includes('failed') ||
              message.toLowerCase().includes('not configured') ||
              message.toLowerCase().includes('fix')
                ? 'helper error-helper'
                : 'helper'
            }
            role="status"
          >
            {message}
          </div>
        )}

        <form className="signup-form" onSubmit={submit} noValidate>
          <label>
            Full name
            <input
              value={form.fullName}
              onChange={set('fullName')}
              placeholder="Your full name"
              autoComplete="name"
              required
            />
          </label>

          <label>
            Email
            <input
              value={form.email}
              onChange={set('email')}
              type="email"
              placeholder="you@company.com"
              autoComplete="email"
              required
            />
          </label>

          <label>
            Password
            <input
              value={form.password}
              onChange={set('password')}
              type="password"
              minLength="8"
              placeholder="At least 8 characters"
              autoComplete="new-password"
              required
            />
          </label>

          <button className="primary signup-submit" disabled={busy}>
            {busy ? 'Creating account…' : 'Create account'}
            {!busy && <ArrowRight size={16} />}
          </button>
        </form>

        <div className="signup-links">
          <button type="button" className="link" onClick={() => navigate('/login')}>
            Back to login
          </button>

          <span>·</span>

          <button type="button" className="link" onClick={() => navigate('/join')}>
            I already have an invite
          </button>
        </div>

        <div className="signup-flow-grid">
          <span>
            <ShieldCheck size={16} />
            <strong>Step 1</strong>
            <small>Create your secure account.</small>
          </span>

          <span>
            <Building2 size={16} />
            <strong>Step 2</strong>
            <small>Create or join a workspace.</small>
          </span>

          <span>
            <Users size={16} />
            <strong>Step 3</strong>
            <small>Invite your team and assign roles.</small>
          </span>

          <span>
            <KeyRound size={16} />
            <strong>Step 4</strong>
            <small>PropFlow routes users by saved role.</small>
          </span>
        </div>

        <div className="signup-guardrail">
          <CheckCircle2 size={16} />
          <span>
            Demo login is not used here. Signup depends on real Supabase Auth and real workspace
            records.
          </span>
        </div>
      </section>
    </div>
  );
}
