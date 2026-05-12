const storagePrefix = 'propflow.modalDraft.';
const installedFlag = '__propflowModalDraftPersistenceInstalled';

function getModalTitle(form) {
  return form.closest('.modal-panel')?.querySelector('h3')?.textContent?.trim() || 'modal-form';
}

function getDraftKey(form) {
  const route = window.location.pathname || '/';
  const title = getModalTitle(form).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `${storagePrefix}${route}.${title}`;
}

function getFieldName(field, index) {
  return field.name || field.id || field.getAttribute('aria-label') || `field-${index}`;
}

function getFields(form) {
  return Array.from(form.querySelectorAll('input, select, textarea'));
}

function readForm(form) {
  return getFields(form).reduce((draft, field, index) => {
    const name = getFieldName(field, index);

    if (field.type === 'checkbox') {
      draft[name] = field.checked;
    } else {
      draft[name] = field.value;
    }

    return draft;
  }, {});
}

function writeForm(form, draft) {
  getFields(form).forEach((field, index) => {
    const name = getFieldName(field, index);

    if (!(name in draft)) return;

    if (field.type === 'checkbox') {
      field.checked = Boolean(draft[name]);
    } else {
      field.value = draft[name];
    }

    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function saveDraft(event) {
  const form = event.target?.closest?.('.modal-form');
  if (!form) return;

  window.sessionStorage.setItem(getDraftKey(form), JSON.stringify(readForm(form)));
}

function clearDraft(event) {
  const form = event.target?.closest?.('.modal-form');
  if (!form) return;

  window.sessionStorage.removeItem(getDraftKey(form));
}

function restoreDraft(form) {
  const rawDraft = window.sessionStorage.getItem(getDraftKey(form));
  if (!rawDraft) return;

  try {
    writeForm(form, JSON.parse(rawDraft));
  } catch {
    window.sessionStorage.removeItem(getDraftKey(form));
  }
}

function restoreVisibleDrafts() {
  document.querySelectorAll('.modal-form').forEach((form) => restoreDraft(form));
}

export function installModalDraftPersistence() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window[installedFlag]) return;

  window[installedFlag] = true;

  document.addEventListener('input', saveDraft);
  document.addEventListener('change', saveDraft);
  document.addEventListener('submit', clearDraft);

  const observer = new MutationObserver(() => {
    window.requestAnimationFrame(restoreVisibleDrafts);
  });

  observer.observe(document.body, { childList: true, subtree: true });
  restoreVisibleDrafts();
}
