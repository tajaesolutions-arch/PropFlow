import React from 'react';
export function EmptyState({ title = 'Nothing here yet', description = 'Create your first record to get started.', action = null }) {
  return <div className="empty-state"><h3>{title}</h3><p>{description}</p>{action && <div className="empty-action">{action}</div>}</div>;
}
