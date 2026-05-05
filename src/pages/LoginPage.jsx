import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { demoUsers } from '../data/sampleData.js';
import { roleLabels } from '../data/constants.js';
import { findDemoUser, getPostLoginPath } from '../lib/auth.js';
import { isSupabaseConfigured } from '../lib/supabase.js';
import { useApp } from '../lib/AppContext.jsx';
import { navigate } from '../routes/AppRouter.jsx';
export function LoginPage() { const { setCurrentUser } = useApp(); const login = (id) => { const user = findDemoUser(id); setCurrentUser(user); navigate(getPostLoginPath(user)); }; return <div className="auth-page"><div className="auth-card"><ShieldCheck size={34}/><h1>Login to PropFlow</h1><p>Real Supabase auth is ready when environment variables are configured. Demo mode stays available without secrets.</p>{!isSupabaseConfigured && <div className="helper">Supabase not configured: using safe demo login mode.</div>}<label>Email<input placeholder="you@company.com" /></label><label>Password<input type="password" placeholder="••••••••" /></label><button className="primary" onClick={() => login('u-owner-admin')}>Login as workspace owner</button><div className="demo-list">{demoUsers.map((user) => <button key={user.id} onClick={() => login(user.id)}><span>{user.name}</span><small>{user.status === 'suspended' ? 'Suspended account' : user.roles.map((role) => roleLabels[role]).join(', ')}</small></button>)}</div><p><button onClick={() => navigate('/signup')}>Create account</button> · <button onClick={() => navigate('/join')}>Join workspace</button></p></div></div>; }
