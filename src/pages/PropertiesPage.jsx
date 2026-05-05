import React from 'react';
import { AppLayout } from '../components/layout/AppLayout.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { FilterBar } from '../components/FilterBar.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { formatCurrency } from '../lib/formatters.js';
import { navigate } from '../routes/AppRouter.jsx';
export function PropertiesPage(){ const { data } = useApp(); return <AppLayout title="Properties"><FilterBar properties={data.properties}/><section className="card"><div className="card-header"><div><h3>Consolidated property view</h3><p>Every row is scoped to the active workspace_id.</p></div><button className="primary">Add property</button></div><DataTable rows={data.properties} columns={[{key:'name',label:'Property',render:r=><button className="link" onClick={()=>navigate(`/properties/${r.id}`)}>{r.name}</button>},{key:'address',label:'Address'},{key:'city',label:'City'},{key:'country',label:'Country'},{key:'type',label:'Type'},{key:'rentalType',label:'Rental'},{key:'bedrooms',label:'Beds'},{key:'bathrooms',label:'Baths'},{key:'maxGuests',label:'Guests'},{key:'owner',label:'Owner'},{key:'cleaner',label:'Cleaner'},{key:'maintenanceCrew',label:'Maintenance'},{key:'rate',label:'Rate',render:r=>formatCurrency(r.rate,r.currency)},{key:'status',label:'Status',render:r=><StatusBadge>{r.status}</StatusBadge>}]} /></section></AppLayout>}
