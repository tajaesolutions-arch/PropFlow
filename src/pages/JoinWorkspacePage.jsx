import React from 'react';
import { navigate } from '../routes/AppRouter.jsx';
export function JoinWorkspacePage() { return <div className="auth-page"><div className="auth-card"><h1>Join a workspace</h1><p>Use a workspace/company code or invite link. The production path will validate against workspace_join_codes and workspace_invites in Supabase.</p><label>Invite link or company code<input placeholder="BLUE-2026" /></label><button className="primary" onClick={() => navigate('/dashboard')}>Join demo workspace</button></div></div>; }
