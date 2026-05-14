import assert from 'node:assert/strict';

import {
  createOptionalModuleFallback,
  isMissingOptionalModuleError,
  resolveOptionalModule,
} from '../src/lib/optionalModuleFallback.js';

assert.equal(isMissingOptionalModuleError({ code: '42P01' }), true);
assert.equal(isMissingOptionalModuleError({ code: 'PGRST205' }), true);
assert.equal(isMissingOptionalModuleError({ code: 'PGRST202' }), true);
assert.equal(isMissingOptionalModuleError({ message: 'relation does not exist' }), true);
assert.equal(isMissingOptionalModuleError({ details: 'schema cache does not include this table' }), true);
assert.equal(isMissingOptionalModuleError({ hint: 'could not find the function' }), true);
assert.equal(isMissingOptionalModuleError({ code: '42501', message: 'permission denied' }), false);

const fallback = createOptionalModuleFallback('properties', { bookings: [{ id: 'booking-1' }] });
assert.equal(Array.isArray(fallback.data.properties), true);
assert.deepEqual(fallback.data.properties, []);
assert.deepEqual(fallback.data.bookings, [{ id: 'booking-1' }]);
assert.equal(fallback.moduleKey, 'properties');
assert.equal(Boolean(fallback.warning), true);

const appContextArrayKeys = [
  'notificationProviderSettings',
  'calendarImportSyncRuns',
  'calendarImportConflicts',
  'billingEvents',
  'members',
  'invites',
  'fileUploads',
  'billingPlanLimits',
];

appContextArrayKeys.forEach((moduleKey) => {
  const moduleFallback = createOptionalModuleFallback(moduleKey);
  assert.equal(Array.isArray(moduleFallback.data[moduleKey]), true, `${moduleKey} fallback should be an array`);
});

const missingResult = await resolveOptionalModule({
  moduleKey: 'calendarImportEvents',
  currentData: { properties: [{ id: 'property-1' }] },
  query: async () => ({ error: { code: '42P01', message: 'missing table' } }),
});
assert.deepEqual(missingResult.data.calendarImportEvents, []);
assert.deepEqual(missingResult.data.properties, [{ id: 'property-1' }]);
assert.equal(Boolean(missingResult.warning), true);

const successResult = await resolveOptionalModule({
  moduleKey: 'bookings',
  currentData: { properties: [{ id: 'property-1' }] },
  query: async () => ({ data: [{ id: 'booking-1' }], error: null }),
});
assert.deepEqual(successResult.data.bookings, [{ id: 'booking-1' }]);
assert.deepEqual(successResult.data.properties, [{ id: 'property-1' }]);
assert.equal(successResult.warning, '');

await assert.rejects(
  () =>
    resolveOptionalModule({
      moduleKey: 'expenses',
      query: async () => ({ error: { code: '42501', message: 'permission denied' } }),
    }),
  /permission denied/,
);

console.log('optionalModuleFallback tests passed');
