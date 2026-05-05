import React from 'react';
import { AppLayout } from '../components/layout/AppLayout.jsx';
export function ComingSoonPage({ title = 'Coming soon' }) { return <AppLayout title={title}><section className="card"><h3>{title}</h3><p>This page is a polished placeholder. It is intentionally not fully implemented in Phase 1 and does not use fake customer data.</p></section></AppLayout>; }
