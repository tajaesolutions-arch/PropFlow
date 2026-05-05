import React from 'react';
import { Ban } from 'lucide-react';
import { navigate } from '../routes/AppRouter.jsx';
export function SuspendedPage({ variant }) { return <div className="auth-page"><div className="auth-card"><Ban size={36}/><h1>{variant === 'denied' ? 'Access restricted' : 'Account suspended'}</h1><p>{variant === 'denied' ? 'Your current role does not have permission to view this workspace area.' : 'This account or membership has been suspended. Contact your workspace owner or PropFlow support.'}</p><button className="primary" onClick={() => navigate('/login')}>Back to login</button></div></div>; }
