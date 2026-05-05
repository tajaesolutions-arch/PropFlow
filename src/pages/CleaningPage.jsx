import React from 'react';
import { Camera, CheckCircle2 } from 'lucide-react';
import { AppLayout } from '../components/layout/AppLayout.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
export function CleaningPage(){ const { data }=useApp(); return <AppLayout title="Cleaning tasks"><div className="task-grid">{data.cleaningTasks.map(task=><section className="card task-card" key={task.id}><div className="card-header"><div><h3>{task.property}</h3><p>Assigned cleaner: {task.cleaner} · Due {task.due}</p></div><StatusBadge>{task.status}</StatusBadge></div><ul className="checklist">{task.checklist.map(item=><li key={item}><CheckCircle2 size={16}/>{item}</li>)}</ul><div className="action-row"><button>Start cleaning</button><button>Mark in progress</button><button>Ready for inspection</button><button className="primary">Mark guest-ready</button></div><div className="helper"><Camera size={16}/> Before/after photo upload placeholder · Report issue: {task.issue || 'None'}</div></section>)}</div></AppLayout>}
