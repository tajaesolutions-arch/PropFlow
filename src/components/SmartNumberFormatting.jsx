import React from 'react';

const FORMATTED_NUMBER_FIELD_PATTERN =
  /\b(rate|rent|amount|fee|fees|payout|cost|price|deposit|revenue|expense|expenses|total|budget|tax|taxes|payment|income|profit|value)\b/i;

function stripNumberFormatting(value) {
  return String(value || '')
    .replace(/,/g, '')
    .replace(/[^\d.-]/g, '');
}

function normalizeNumberText(value) {
  const stripped = stripNumberFormatting(value);

  if (!stripped) return '';

  const isNegative = stripped.startsWith('-');
  const unsigned = stripped.replace(/-/g, '');
  const [integerPart = '', ...decimalParts] = unsigned.split('.');
  const decimalPart = decimalParts.join('').slice(0, 2);
  const hasDecimal = unsigned.includes('.');

  const integer = integerPart.replace(/^0+(?=\d)/, '') || '0';

  return `${isNegative ? '-' : ''}${integer}${hasDecimal ? `.${decimalPart}` : ''}`;
}

function formatNumberText(value) {
  const normalized = normalizeNumberText(value);

  if (!normalized || normalized === '-' || normalized === '.' || normalized === '-.') {
    return normalized;
  }

  const isNegative = normalized.startsWith('-');
  const unsigned = isNegative ? normalized.slice(1) : normalized;
  const [integerPart = '', decimalPart] = unsigned.split('.');
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const decimalSuffix = normalized.includes('.') ? `.${decimalPart ?? ''}` : '';

  return `${isNegative ? '-' : ''}${formattedInteger}${decimalSuffix}`;
}

function getInputContext(input) {
  const explicitLabel = input.id
    ? document.querySelector(`label[for="${CSS.escape(input.id)}"]`)
    : null;

  const wrapperLabel = input.closest('label');

  return [
    input.name,
    input.id,
    input.placeholder,
    input.getAttribute('aria-label'),
    input.dataset.commaFormat,
    explicitLabel?.textContent,
    wrapperLabel?.textContent,
  ]
    .filter(Boolean)
    .join(' ');
}

function shouldFormatInput(input) {
  if (!(input instanceof HTMLInputElement)) return false;
  if (input.disabled || input.readOnly) return false;
  if (input.dataset.noCommaFormat === 'true') return false;
  if (input.dataset.commaFormat === 'true') return true;

  const inputType = String(input.getAttribute('type') || input.type || '').toLowerCase();

  if (!['number', 'text', 'tel'].includes(inputType)) return false;

  return FORMATTED_NUMBER_FIELD_PATTERN.test(getInputContext(input));
}

function prepareInput(input) {
  if (!shouldFormatInput(input)) return;

  if (input.type === 'number') {
    input.type = 'text';
  }

  input.inputMode = 'decimal';
  input.autocomplete = input.autocomplete || 'off';
  input.dataset.commaFormat = 'true';
}

function formatInputDisplay(input) {
  if (!shouldFormatInput(input)) return;

  prepareInput(input);

  const nextValue = formatNumberText(input.value);

  if (input.value !== nextValue) {
    const focused = document.activeElement === input;
    input.value = nextValue;

    if (focused) {
      const end = input.value.length;

      try {
        input.setSelectionRange(end, end);
      } catch {
        // Some browser/input combinations do not allow selection updates.
      }
    }
  }
}

export function SmartNumberFormatting() {
  React.useEffect(() => {
    const prepareAll = () => {
      document.querySelectorAll('input').forEach((input) => {
        if (shouldFormatInput(input)) {
          prepareInput(input);
          formatInputDisplay(input);
        }
      });
    };

    const onFocusIn = (event) => {
      if (event.target instanceof HTMLInputElement) {
        prepareInput(event.target);
        formatInputDisplay(event.target);
      }
    };

    const onInput = (event) => {
      if (event.target instanceof HTMLInputElement && shouldFormatInput(event.target)) {
        window.requestAnimationFrame(() => formatInputDisplay(event.target));
      }
    };

    const observer = new MutationObserver(() => prepareAll());

    prepareAll();

    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('input', onInput, true);

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      document.removeEventListener('focusin', onFocusIn, true);
      document.removeEventListener('input', onInput, true);
      observer.disconnect();
    };
  }, []);

  return null;
}
