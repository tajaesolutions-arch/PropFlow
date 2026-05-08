export function parseFormattedNumber(value, fallback = 0) {
  if (value === '' || value === null || value === undefined) {
    return fallback;
  }

  const cleanValue = String(value)
    .replace(/,/g, '')
    .replace(/[^\d.-]/g, '')
    .trim();

  if (!cleanValue || cleanValue === '-' || cleanValue === '.' || cleanValue === '-.') {
    return fallback;
  }

  const number = Number(cleanValue);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return number;
}

export function safeNumber(value, fallback = 0) {
  return parseFormattedNumber(value, fallback);
}

export function cleanNumberInput(value, fallback = null) {
  return parseFormattedNumber(value, fallback);
}

export function formatNumberInput(value, options = {}) {
  if (value === '' || value === null || value === undefined) return '';

  const cleanValue = String(value)
    .replace(/,/g, '')
    .replace(/[^\d.-]/g, '')
    .trim();

  if (!cleanValue || cleanValue === '-' || cleanValue === '.' || cleanValue === '-.') {
    return '';
  }

  const number = Number(cleanValue);

  if (!Number.isFinite(number)) return '';

  return new Intl.NumberFormat(options.locale || 'en-US', {
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
  }).format(number);
}

export function formatCurrency(value, currency = 'USD', options = {}) {
  const amount = safeNumber(value, 0);
  const safeCurrency = String(currency || 'USD').toUpperCase();

  const formatterOptions = {
    style: 'currency',
    currency: safeCurrency,
    maximumFractionDigits: options.maximumFractionDigits ?? 0,
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
  };

  try {
    return new Intl.NumberFormat(options.locale || 'en-US', formatterOptions).format(amount);
  } catch (error) {
    return new Intl.NumberFormat(options.locale || 'en-US', {
      maximumFractionDigits: formatterOptions.maximumFractionDigits,
      minimumFractionDigits: formatterOptions.minimumFractionDigits,
    }).format(amount);
  }
}

export function formatPercent(value, options = {}) {
  const number = safeNumber(value, 0);

  const percent = Math.abs(number) <= 1 && number !== 0 ? number * 100 : number;

  return `${Math.round(percent)}%`;
}

export function compactNumber(value, options = {}) {
  return new Intl.NumberFormat(options.locale || 'en-US', {
    notation: 'compact',
    maximumFractionDigits: options.maximumFractionDigits ?? 1,
  }).format(safeNumber(value, 0));
}

export function formatDate(value, fallback = '—') {
  if (!value) return fallback;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return date.toLocaleDateString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(value, fallback = '—') {
  if (!value) return fallback;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
