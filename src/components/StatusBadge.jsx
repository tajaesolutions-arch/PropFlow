import React from 'react';

function normalize(value) {
  return String(value || 'unknown').toLowerCase().replaceAll('_', ' ').trim();
}

function resolveTone(text, tone) {
  if (tone) return tone;

  const value = normalize(text);

  if (
    value.includes('critical') ||
    value.includes('cancel') ||
    value.includes('blocked') ||
    value.includes('suspended') ||
    value.includes('denied') ||
    value.includes('failed') ||
    value.includes('terminated') ||
    value.includes('expired') ||
    value.includes('out of stock') ||
    value.includes('archived')
  ) {
    return 'error';
  }

  if (
    value.includes('urgent') ||
    value.includes('waiting') ||
    value.includes('overdue') ||
    value.includes('hold') ||
    value.includes('pending') ||
    value.includes('low stock') ||
    value.includes('needs inspection') ||
    value.includes('partially paid') ||
    value.includes('ending soon') ||
    value.includes('setup required') ||
    value.includes('not configured')
  ) {
    return 'warning';
  }

  if (
    value.includes('ready') ||
    value.includes('active') ||
    value.includes('paid') ||
    value.includes('completed') ||
    value.includes('guest') ||
    value.includes('confirmed') ||
    value.includes('accepted') ||
    value.includes('in stock') ||
    value.includes('configured') ||
    value.includes('approved') ||
    value.includes('current')
  ) {
    return 'success';
  }

  return 'info';
}

function displayText(value) {
  return String(value || 'unknown').replaceAll('_', ' ');
}

export function StatusBadge({ children = 'unknown', tone, title }) {
  const resolvedTone = resolveTone(children, tone);

  return (
    <span className={`status status-${resolvedTone}`} title={title || displayText(children)}>
      {displayText(children)}
    </span>
  );
}
