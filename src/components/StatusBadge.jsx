import React from 'react';
export function StatusBadge({ children, tone }) {
  const text = String(children || '').toLowerCase();
  const resolved = tone || (text.includes('critical') || text.includes('cancel') || text.includes('blocked') || text.includes('suspended') ? 'error' : text.includes('urgent') || text.includes('waiting') || text.includes('overdue') || text.includes('hold') ? 'warning' : text.includes('ready') || text.includes('active') || text.includes('paid') || text.includes('completed') || text.includes('guest') ? 'success' : 'info');
  return <span className={`status status-${resolved}`}>{children}</span>;
}
