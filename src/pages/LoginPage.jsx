import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { useApp } from '../lib/AppContext.jsx';
import { navigate } from '../routes/AppRouter.jsx';

export function LoginPage() {
  const { signIn, isSupabaseConfigured } = useApp();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const submit = async (event) => {
    event.preventDefault();
    if (!isSupabaseConfigured) { setMessage('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to use real authentication.'); return; }
    setBusy(true); setMessage('');
    try { await signIn(email, password); navigate('/login/redirect'); } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  };
  return <div className="auth-page"><form className="auth-card" onSubmit={submit}><ShieldCheck size={34}/><h1>Login to PropFlow</h1><p>Use your Supabase Auth account. Your workspace, roles, and access are loaded from the database after login.</p>{!isSupabaseConfigured && <div className="helper">Supabase is not configured. Demo login has been removed from production UI.</div>}<label>Email<input value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@company.com" type="email" required /></label><label>Password<input value={password} onChange={(e)=>setPassword(e.target.value)} type="password" placeholder="••••••••" required /></label>{message && <div className="helper error-helper">{message}</div>}<button className="primary" disabled={busy}>{busy ? 'Signing in…' : 'Login'}</button><p><button type="button" className="link" onClick={() => navigate('/signup')}>Create account</button> · <button type="button" className="link" onClick={() => navigate('/workspace-setup')}>I have an invite or code</button></p></form></div>;
}
