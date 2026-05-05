export function formatCurrency(value, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value || 0);
}
export function formatPercent(value) { return `${Math.round(value || 0)}%`; }
export function compactNumber(value) { return new Intl.NumberFormat('en-US', { notation: 'compact' }).format(value || 0); }
