import React from 'react';
import { useApp } from '../lib/AppContext.jsx';
import { navigate } from '../routes/AppRouter.jsx';

export function SignupPage() {
  const { signUp, isSupabaseConfigured } = useApp();

  const [form, setForm] = React.useState({
    fullName: '',
    email: '',
    password: '',
  });

  const [message, setMessage] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const set = (key) => (event) => {
    setForm((value) => ({
      ...value,
      [key]: event.target.value,
    }));
  };

  const submit = async (event) => {
    event.preventDefault();

    if (!isSupabaseConfigured) {
      setMessage('Supabase is not configured. Add env vars before creating real accounts.');
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      const authData = await signUp(form);

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
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <h1>Create your PropFlow account</h1>

        <p>
          After signup, create a workspace or join an existing workspace with a valid invite for
          your email.
        </p>

        <label>
          Full name
          <input value={form.fullName} onChange={set('fullName')} required />
        </label>

        <label>
          Email
          <input value={form.email} onChange={set('email')} type="email" required />
        </label>

        <label>
          Password
          <input
            value={form.password}
            onChange={set('password')}
            type="password"
            minLength="8"
            required
          />
        </label>

        {message && <div className="helper">{message}</div>}

        <button className="primary" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>

        <button type="button" className="link" onClick={() => navigate('/login')}>
          Back to login
        </button>
      </form>
    </div>
  );
}
