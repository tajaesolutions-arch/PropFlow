import React from 'react';
import { AppLayout } from '../components/layout/AppLayout.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { useApp } from '../lib/AppContext.jsx';
export function OwnerDashboardPage(){ const { data }=useApp(); return <AppLayout title="Owner dashboard"><p className="page-note">Owners only see assigned property data. Financial reports and exports are deferred.</p>{data.properties.length?<section className="card"><h3>Assigned properties</h3><DataTable rows={data.properties} columns={[{key:'name',label:'Property'},{key:'status',label:'Status',render:r=><StatusBadge>{r.status}</StatusBadge>},{key:'rental_type',label:'Rental'}]} /></section>:<EmptyState title="No assigned properties yet." description="Your property manager has not assigned properties to this owner account." />}</AppLayout>}
