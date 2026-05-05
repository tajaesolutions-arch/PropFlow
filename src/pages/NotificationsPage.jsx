import React from 'react';
import { AppLayout } from '../components/layout/AppLayout.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
export function NotificationsPage(){ const { data }=useApp(); return <AppLayout title="Notifications"><section className="card"><h3>Notification center</h3>{data.notifications.map(n=><div className="notification" key={n.id}><StatusBadge tone={n.tone}>{n.type}</StatusBadge><span>{n.message}<small>{n.time}</small></span></div>)}</section></AppLayout>}
