import React from 'react';
import { AppLayout } from '../components/layout/AppLayout.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { propertyOwners } from '../data/sampleData.js';
export function OwnersPage(){ return <AppLayout title="Owners"><section className="card"><h3>Property owners</h3><DataTable rows={propertyOwners} columns={[{key:'name',label:'Owner'},{key:'email',label:'Email'},{key:'phone',label:'Phone'},{key:'payoutPreference',label:'Payout preference'}]} /></section></AppLayout>}
