const storagePrefix = 'propflow.modalDraft.';
const installedFlag = '__propflowModalDraftPersistenceInstalled';
const UNSAVED_CHANGES_MESSAGE = 'You have unsaved changes. Close without saving?';

const dirtyForms = new WeakSet();
const submittedForms = new WeakSet();

function getModalPanel(form) {
  return form.closest('.modal-panel');
}

function getModalTitle(form) {
  return getModalPanel(form)?.querySelector('h3')?.textContent?.trim() || 'modal-form';
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

function markDirty(form) {
  dirtyForms.add(form);
  submittedForms.delete(form);
}

function isDirty(form) {
  return dirtyForms.has(form) && !submittedForms.has(form);
}

function saveDraft(event) {
  const form = event.target?.closest?.('.modal-form');
  if (!form) return;

  markDirty(form);
  window.sessionStorage.setItem(getDraftKey(form), JSON.stringify(readForm(form)));
}

function clearDraft(event) {
  const form = event.target?.closest?.('.modal-form');
  if (!form) return;

  submittedForms.add(form);
  window.sessionStorage.removeItem(getDraftKey(form));
}

function restoreDraft(form) {
  const rawDraft = window.sessionStorage.getItem(getDraftKey(form));
  if (!rawDraft) return;

  try {
    writeForm(form, JSON.parse(rawDraft));
    dirtyForms.add(form);
  } catch {
    window.sessionStorage.removeItem(getDraftKey(form));
  }
}

function restoreVisibleDrafts() {
  document.querySelectorAll('.modal-form').forEach((form) => restoreDraft(form));
}

function getActiveModalForm() {
  return document.querySelector('.modal-panel .modal-form');
}

function getCloseTargetForm(event) {
  const target = event.target;
  if (!(target instanceof Element)) return null;

  if (event.type === 'keydown') {
    if (event.key !== 'Escape') return null;
    return getActiveModalForm();
  }

  if (event.type === 'mousedown') {
    if (!target.classList.contains('modal-backdrop')) return null;
    return target.querySelector('.modal-form');
  }

  if (event.type === 'click') {
    const button = target.closest('button');
    if (!button) return null;

    const closeButton = button.getAttribute('aria-label') === 'Close modal';
    const cancelButton = button.type === 'button' && button.closest('.modal-actions');

    if (!closeButton && !cancelButton) return null;

    return button.closest('.modal-panel')?.querySelector('.modal-form') || null;
  }

  return null;
}

function confirmCloseIfNeeded(event) {
  const form = getCloseTargetForm(event);

  if (!form || !isDirty(form)) return;
  if (window.confirm(UNSAVED_CHANGES_MESSAGE)) return;

  event.preventDefault();
  event.stopPropagation();
}

export function installModalDraftPersistence() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window[installedFlag]) return;

  window[installedFlag] = true;

  document.addEventListener('input', saveDraft);
  document.addEventListener('change', saveDraft);
  document.addEventListener('submit', clearDraft);
  document.addEventListener('click', confirmCloseIfNeeded, true);
  document.addEventListener('mousedown', confirmCloseIfNeeded, true);
  document.addEventListener('keydown', confirmCloseIfNeeded, true);

  const observer = new MutationObserver(() => {
    window.requestAnimationFrame(restoreVisibleDrafts);
  });

  observer.observe(document.body, { childList: true, subtree: true });
  restoreVisibleDrafts();
}
