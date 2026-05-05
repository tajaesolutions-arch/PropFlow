import React from 'react';
import { useApp } from '../lib/AppContext.jsx';
import { navigate } from '../routes/AppRouter.jsx';
export function SignupPage() {
  const { signUp, isSupabaseConfigured } = useApp();
  const [form, setForm] = React.useState({ fullName: '', email: '', password: '' });
  const [message, setMessage] = React.useState('');
  const set = (key) => (e) => setForm((value) => ({ ...value, [key]: e.target.value }));
  const submit = async (event) => { event.preventDefault(); if (!isSupabaseConfigured) { setMessage('Supabase is not configured. Add env vars before creating real accounts.'); return; } try { await signUp(form); setMessage('Account created. Check your email if confirmation is enabled, then continue to workspace setup.'); navigate('/workspace-setup'); } catch (error) { setMessage(error.message); } };
  return <div className="auth-page"><form className="auth-card" onSubmit={submit}><h1>Create your PropFlow account</h1><p>After signup, create a workspace or join with a valid invite for your email.</p><label>Full name<input value={form.fullName} onChange={set('fullName')} required /></label><label>Email<input value={form.email} onChange={set('email')} type="email" required /></label><label>Password<input value={form.password} onChange={set('password')} type="password" minLength="8" required /></label>{message && <div className="helper">{message}</div>}<button className="primary">Create account</button><button type="button" onClick={() => navigate('/login')}>Back to login</button></form></div>;
}
