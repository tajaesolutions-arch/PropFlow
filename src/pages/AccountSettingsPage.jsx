import React from 'react';
import { AppLayout } from '../components/layout/AppLayout.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { roleLabels } from '../data/constants.js';
export function AccountSettingsPage(){ const { currentUser }=useApp(); return <AppLayout title="Account settings"><section className="card"><h3>Profile</h3><label>Name<input defaultValue={currentUser.name}/></label><label>Email<input defaultValue={currentUser.email}/></label><p>Roles in this workspace: {currentUser.roles.map(r=>roleLabels[r]).join(', ')}</p><p>Status: {currentUser.status}</p></section></AppLayout>}
