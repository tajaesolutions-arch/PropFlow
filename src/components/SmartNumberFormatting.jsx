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

function moveCaretToEnd(input) {
  if (document.activeElement !== input) return;

  try {
    const end = input.value.length;
    input.setSelectionRange(end, end);
  } catch {
    // Some browser/input combinations do not allow selection updates.
  }
}

function setNativeValue(input, value) {
  const valueSetter = Object.getOwnPropertyDescriptor(input, 'value')?.set;
  const prototype = Object.getPrototypeOf(input);
  const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

  if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
    prototypeValueSetter.call(input, value);
    return;
  }

  if (valueSetter) {
    valueSetter.call(input, value);
    return;
  }

  input.value = value;
}

function showFormattedValue(input) {
  if (!shouldFormatInput(input)) return;

  prepareInput(input);

  const formattedValue = formatNumberText(input.value);

  if (input.value !== formattedValue) {
    input.value = formattedValue;
    moveCaretToEnd(input);
  }
}

function normalizeBeforeReactReadsValue(input) {
  if (!shouldFormatInput(input)) return;

  prepareInput(input);

  const normalizedValue = normalizeNumberText(input.value);

  if (input.value !== normalizedValue) {
    setNativeValue(input, normalizedValue);
  }
}

export function SmartNumberFormatting() {
  React.useEffect(() => {
    const prepareAll = () => {
      document.querySelectorAll('input').forEach((input) => {
        if (shouldFormatInput(input)) {
          prepareInput(input);
          showFormattedValue(input);
        }
      });
    };

    const onFocusIn = (event) => {
      if (!(event.target instanceof HTMLInputElement)) return;

      prepareInput(event.target);
      window.requestAnimationFrame(() => showFormattedValue(event.target));
    };

    const onInputCapture = (event) => {
      if (!(event.target instanceof HTMLInputElement)) return;
      if (!shouldFormatInput(event.target)) return;

      normalizeBeforeReactReadsValue(event.target);

      window.requestAnimationFrame(() => {
        showFormattedValue(event.target);
      });
    };

    const observer = new MutationObserver(() => {
      prepareAll();
    });

    prepareAll();

    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('input', onInputCapture, true);

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      document.removeEventListener('focusin', onFocusIn, true);
      document.removeEventListener('input', onInputCapture, true);
      observer.disconnect();
    };
  }, []);

  return null;
}
