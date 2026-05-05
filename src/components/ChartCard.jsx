import React from 'react';
export function ChartCard({ title, subtitle, children }) {
  return <section className="card chart-card"><div className="card-header"><div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div></div>{children}</section>;
}
