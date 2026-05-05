import React from 'react';
import { AppLayout } from '../components/layout/AppLayout.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { formatCurrency } from '../lib/formatters.js';
export function BookingsPage(){ const { data, currentWorkspace }=useApp(); return <AppLayout title="Bookings"><section className="card"><div className="card-header"><div><h3>Booking management</h3><p>Airbnb-style, direct, platform, and long-term bookings.</p></div><button className="primary">Add booking</button></div><DataTable rows={data.bookings} columns={[{key:'guest',label:'Guest name'},{key:'property',label:'Property'},{key:'checkIn',label:'Check-in'},{key:'checkOut',label:'Check-out'},{key:'source',label:'Booking source'},{key:'total',label:'Total',render:r=>formatCurrency(r.total,currentWorkspace.defaultCurrency)},{key:'cleaningFee',label:'Cleaning fee',render:r=>formatCurrency(r.cleaningFee,currentWorkspace.defaultCurrency)},{key:'platformFee',label:'Platform fee',render:r=>formatCurrency(r.platformFee,currentWorkspace.defaultCurrency)},{key:'status',label:'Status',render:r=><StatusBadge>{r.status}</StatusBadge>},{key:'paymentStatus',label:'Payment',render:r=><StatusBadge>{r.paymentStatus}</StatusBadge>},{key:'notes',label:'Notes'}]} /></section></AppLayout>}
