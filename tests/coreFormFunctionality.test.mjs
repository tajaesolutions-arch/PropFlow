import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const provider = fs.readFileSync('src/components/CreateActionProvider.jsx', 'utf8');
const pages = [
  'src/pages/DashboardPage.jsx','src/pages/OnboardingPage.jsx','src/pages/PropertiesPage.jsx','src/pages/BookingsPage.jsx','src/pages/CleaningPage.jsx','src/pages/MaintenancePage.jsx','src/pages/OwnersPage.jsx','src/pages/GuestsPage.jsx','src/pages/InventoryPage.jsx','src/pages/CalendarPage.jsx',
].map((p) => fs.readFileSync(p, 'utf8')).join('\n');
const validation = fs.readFileSync('src/lib/formValidation.js', 'utf8');

function actionKeys(text) {
  return [...text.matchAll(/data-create-action=\"([^\"]+)\"|data-create-action=\{\s*'([^']+)'\s*\}/g)].map((m) => m[1] || m[2]);
}

test('CreateActionProvider supports referenced create-action keys', () => {
  const supported = [...provider.matchAll(/action:\s*'([a-z_]+)'/g)].map((m) => m[1]);
  const used = Array.from(new Set(actionKeys(pages)));
  const unsupported = used.filter((k) => !supported.includes(k));
  assert.deepEqual(unsupported, []);
});

test('validation helpers exist for core forms', () => {
  ['validatePropertyForm','validateBookingForm','validateCleaningTaskForm','validateMaintenanceWorkOrderForm','validateOwnerForm','validateGuestForm','validateSupplyForm','isValidEmail','parseOptionalNumber'].forEach((name)=>{
    assert.match(validation, new RegExp(`export function ${name}\\s*\\(`));
  });
});

test('provider forms include required, date-order, numeric, and submit-state checks', () => {
  assert.match(provider, /Address or location is required\./);
  assert.match(provider, /Check-out must be after check-in\./);
  assert.match(provider + validation, /must be a valid number|must be numeric|Must be a valid number/);
  assert.match(provider, /disabled=\{submitting/);
});

test('no sampleData imports in form submission surfaces', () => {
  assert.ok(!provider.includes('sampleData'));
  assert.ok(!pages.includes('sampleData'));
});

test('create and update helpers require workspaceId and no service-role key in frontend', () => {
  const helperFiles = ['src/lib/properties.js','src/lib/bookings.js','src/lib/cleaningTasks.js','src/lib/maintenanceWorkOrders.js','src/lib/owners.js','src/lib/guests.js','src/lib/supplies.js'].map((p)=>fs.readFileSync(p,'utf8')).join('\n');
  assert.match(helperFiles, /workspaceId/);
  const srcAll = helperFiles + provider + pages;
  assert.ok(!/service[_-]?role/i.test(srcAll));
});
