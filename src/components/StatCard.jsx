import React from 'react';
export function StatCard({ label, value, icon: Icon, trend, tone = 'accent' }) {
  return <div className="stat-card"><div><p>{label}</p><strong>{value}</strong>{trend && <span className={`trend trend-${tone}`}>{trend}</span>}</div>{Icon && <div className="stat-icon"><Icon size={20} /></div>}</div>;
}
