import React from 'react';
import { AppLayout } from '../components/layout/AppLayout.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { guests } from '../data/sampleData.js';
import { formatCurrency } from '../lib/formatters.js';
export function GuestsPage(){ return <AppLayout title="Guests / CRM"><section className="card"><h3>Guest relationship management</h3><DataTable rows={guests} columns={[{key:'name',label:'Guest'},{key:'email',label:'Email'},{key:'phone',label:'Phone'},{key:'lastStay',label:'Last stay'},{key:'source',label:'Source'},{key:'lifetimeValue',label:'Lifetime value',render:r=>formatCurrency(r.lifetimeValue)}]} /></section></AppLayout>}
