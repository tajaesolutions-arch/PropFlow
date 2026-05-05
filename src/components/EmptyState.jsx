import React from 'react';
export function EmptyState({ title = 'Nothing here yet', description = 'Create records or reset sample data from Settings.' }) {
  return <div className="empty-state"><h3>{title}</h3><p>{description}</p></div>;
}
