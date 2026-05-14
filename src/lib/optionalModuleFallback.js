import { getSafeWorkspaceDataFallback, workspaceDataFallbackWarning } from './safeAppState.js';

export function isMissingOptionalModuleError(error) {
  const code = String(error?.code || '').trim();
  const message = [error?.message, error?.details, error?.hint, error?.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    code === 'PGRST202' ||
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('could not find')
  );
}

export function createOptionalModuleFallback(moduleKey, currentData = {}, warning = workspaceDataFallbackWarning) {
  const fallbackData = getSafeWorkspaceDataFallback({
    ...currentData,
    [moduleKey]: null,
  });

  return {
    data: fallbackData,
    warning,
    moduleKey,
  };
}

export async function resolveOptionalModule({ moduleKey, query, currentData = {}, warning = workspaceDataFallbackWarning }) {
  if (typeof query !== 'function') {
    return createOptionalModuleFallback(moduleKey, currentData, warning);
  }

  try {
    const result = await query();

    if (result?.error) {
      if (isMissingOptionalModuleError(result.error)) {
        return createOptionalModuleFallback(moduleKey, currentData, warning);
      }

      throw result.error;
    }

    return {
      data: getSafeWorkspaceDataFallback({
        ...currentData,
        [moduleKey]: result?.data,
      }),
      warning: '',
      moduleKey,
    };
  } catch (error) {
    if (isMissingOptionalModuleError(error)) {
      return createOptionalModuleFallback(moduleKey, currentData, warning);
    }

    throw error;
  }
}
