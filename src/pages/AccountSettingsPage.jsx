import React from 'react';
import { AppLayout } from '../components/layout/AppLayout.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { roleLabels } from '../data/constants.js';
export function AccountSettingsPage(){ const { currentUser, signOut }=useApp(); return <AppLayout title="Account settings"><section className="card"><h3>Profile</h3><label>Name<input value={currentUser?.name || ''} readOnly/></label><label>Email<input value={currentUser?.email || ''} readOnly/></label><p>Roles in this workspace: {(currentUser?.roles || []).map(r=>roleLabels[r] || r).join(', ') || 'No workspace role yet'}</p><p>Status: {currentUser?.status}</p><button className="danger" onClick={signOut}>Logout</button></section></AppLayout>}
