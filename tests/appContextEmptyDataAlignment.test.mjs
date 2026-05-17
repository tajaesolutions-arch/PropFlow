import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { safeEmptyWorkspaceData } from '../src/lib/safeAppState.js';

// AppContext currently keeps historical aliases for a few values that were named
// before safeEmptyWorkspaceData became the canonical fallback contract. These are
// intentionally allowlisted so formatting-only changes do not fail the test.
const appContextAliases = {
  reports: ['ownerReports'],
  files: ['fileUploads'],
  calendarImportedEvents: ['calendarImportEvents'],
  workspaceInvites: ['invites'],
  workspaceMembers: ['members'],
};

function extractObjectLiteral(source, declarationName) {
  const declarationIndex = source.indexOf(`const ${declarationName} =`);
  assert.notEqual(declarationIndex, -1, `AppContext ${declarationName} object should exist`);

  const start = source.indexOf('{', declarationIndex);
  assert.notEqual(start, -1, `AppContext ${declarationName} object should start with an object literal`);

  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];

    if (character === '{') depth += 1;
    if (character === '}') depth -= 1;

    if (depth === 0) {
      return source.slice(start, index + 1);
    }
  }

  throw new Error(`Could not find the end of ${declarationName}`);
}

function readAppContextEmptyData() {
  const source = readFileSync(new URL('../src/lib/AppContext.jsx', import.meta.url), 'utf8');
  const objectLiteral = extractObjectLiteral(source, 'emptyData');

  // The object contains only static literals. Evaluating this isolated literal is
  // less brittle than matching keys with regexes, and it lets the test verify
  // actual value shapes instead of formatting.
  return Function(`"use strict"; return (${objectLiteral});`)();
}

const appContextEmptyData = readAppContextEmptyData();
const appContextKeys = new Set(Object.keys(appContextEmptyData));

const missingKeys = Object.keys(safeEmptyWorkspaceData).filter((key) => {
  if (appContextKeys.has(key)) return false;
  return !appContextAliases[key]?.some((alias) => appContextKeys.has(alias));
});

assert.deepEqual(missingKeys, [], `AppContext emptyData is missing safe fallback keys or aliases: ${missingKeys.join(', ')}`);

Object.entries(safeEmptyWorkspaceData).forEach(([key, safeValue]) => {
  const appContextKey = appContextKeys.has(key)
    ? key
    : appContextAliases[key]?.find((alias) => appContextKeys.has(alias));

  assert.ok(appContextKey, `${key} should exist in AppContext emptyData or have an explicit alias`);

  const appContextValue = appContextEmptyData[appContextKey];

  if (Array.isArray(safeValue)) {
    assert.equal(Array.isArray(appContextValue), true, `${appContextKey} should keep an array-safe fallback`);
  } else if (safeValue && typeof safeValue === 'object') {
    assert.deepEqual(appContextValue, safeValue, `${appContextKey} should keep the canonical object fallback`);
  } else {
    assert.equal(appContextValue, safeValue, `${appContextKey} should keep the canonical scalar fallback`);
  }
});

console.log('AppContext emptyData alignment tests passed');
