import React from 'react';
import { Inbox } from 'lucide-react';

export function EmptyState({
  title = 'Nothing here yet',
  description = 'Create your first record to get started.',
  action = null,
  secondaryAction = null,
  icon: Icon = Inbox,
  eyebrow = '',
  compact = false,
}) {
  return (
    <div className={`empty-state ${compact ? 'compact-empty-state' : ''}`}>
      {Icon && (
        <div className="empty-state-icon" aria-hidden="true">
          <Icon size={26} />
        </div>
      )}

      {eyebrow && <p className="eyebrow">{eyebrow}</p>}

      <h3>{title}</h3>
      <p>{description}</p>

      {(action || secondaryAction) && (
        <div className="empty-action">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
