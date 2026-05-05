import React from 'react';
import { Download } from 'lucide-react';
import { AppLayout } from '../components/layout/AppLayout.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { reportTypes } from '../data/sampleData.js';
import { formatCurrency } from '../lib/formatters.js';
export function ReportsPage(){ const { data, currentWorkspace }=useApp(); return <AppLayout title="Reports"><div className="report-type-grid">{reportTypes.map(type=><section className="card compact" key={type}><h3>{type}</h3><p>PDF/CSV export placeholder.</p><button><Download size={16}/> Export</button></section>)}</div><section className="card"><div className="card-header"><div><h3>Automatic monthly owner reports</h3><p>Monthly report email enabled. TODO: connect report generator and storage bucket.</p></div></div><DataTable rows={data.ownerReports} columns={[{key:'owner',label:'Owner'},{key:'property',label:'Property'},{key:'type',label:'Type'},{key:'period',label:'Period'},{key:'status',label:'Status',render:r=><StatusBadge>{r.status}</StatusBadge>},{key:'emailEnabled',label:'Automation',render:r=>r.emailEnabled?'Monthly report email enabled':'Disabled'},{key:'payout',label:'Owner payout',render:r=>formatCurrency(r.payout,currentWorkspace.defaultCurrency)},{key:'id',label:'Download',render:()=> <><button>PDF</button><button>CSV</button></>}]} /></section></AppLayout>}
