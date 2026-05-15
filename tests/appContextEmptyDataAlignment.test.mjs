import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { safeEmptyWorkspaceData } from '../src/lib/safeAppState.js';

const appContextAliases = {
  reports: ['ownerReports'],
  files: ['fileUploads'],
  calendarImportedEvents: ['calendarImportEvents'],
  workspaceInvites: ['invites'],
  workspaceMembers: ['members'],
};

function blockHasKey(block, key) {
  return new RegExp(`\\b${key}\\s*:`).test(block);
}

const source = readFileSync(new URL('../src/lib/AppContext.jsx', import.meta.url), 'utf8');
const emptyDataMatch = source.match(/const emptyData = \{([\s\S]*?)\n\};/);

assert.ok(emptyDataMatch, 'AppContext emptyData object should exist');

const emptyDataBlock = emptyDataMatch[1];
const expectedKeys = Object.keys(safeEmptyWorkspaceData);
const missingKeys = expectedKeys.filter((key) => {
  if (blockHasKey(emptyDataBlock, key)) return false;
  return !appContextAliases[key]?.some((alias) => blockHasKey(emptyDataBlock, alias));
});

assert.deepEqual(missingKeys, [], `AppContext emptyData is missing safe fallback keys or aliases: ${missingKeys.join(', ')}`);

const arrayKeys = expectedKeys.filter((key) => Array.isArray(safeEmptyWorkspaceData[key]));
const nonArrayKeys = expectedKeys.filter((key) => !Array.isArray(safeEmptyWorkspaceData[key]));

assert.ok(arrayKeys.length > 0, 'safeEmptyWorkspaceData should define array fallback keys');
assert.ok(nonArrayKeys.length > 0, 'safeEmptyWorkspaceData should define non-array fallback keys');

console.log('AppContext emptyData alignment tests passed');
