import React from 'react';

export function StatCard({
  label = 'Metric',
  value = '—',
  icon: Icon,
  trend,
  tone = 'accent',
  subtitle,
  onClick,
  className = '',
}) {
  const CardTag = typeof onClick === 'function' ? 'button' : 'div';

  return (
    <CardTag
      type={typeof onClick === 'function' ? 'button' : undefined}
      className={`stat-card stat-card-${tone} ${onClick ? 'clickable-stat-card' : ''} ${className}`}
      onClick={onClick}
    >
      <div>
        <p>{label}</p>
        <strong>{value ?? '—'}</strong>

        {subtitle && <small>{subtitle}</small>}

        {trend && <span className={`trend trend-${tone}`}>{trend}</span>}
      </div>

      {Icon && (
        <div className={`stat-icon stat-icon-${tone}`}>
          <Icon size={20} />
        </div>
      )}
    </CardTag>
  );
}
