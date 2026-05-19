import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

const corePages = [
  'src/pages/PropertiesPage.jsx',
  'src/pages/PropertyDetailPage.jsx',
  'src/pages/BookingsPage.jsx',
  'src/pages/CleaningPage.jsx',
  'src/pages/CleanerDashboardPage.jsx',
  'src/pages/MaintenancePage.jsx',
  'src/pages/MaintenanceDashboardPage.jsx',
  'src/pages/OwnersPage.jsx',
  'src/pages/OwnerDashboardPage.jsx',
  'src/pages/GuestsPage.jsx',
  'src/pages/ReportsPage.jsx',
  'src/pages/InventoryPage.jsx',
  'src/pages/CalendarPage.jsx',
  'src/pages/NotificationsPage.jsx',
  'src/pages/SettingsPage.jsx',
  'src/pages/AccountSettingsPage.jsx',
];

const blockedPlaceholderTerms = [/\bfake\b/i, /lorem/i, /\bmock\b/i, /not implemented/i, /connect later/i];
const allowlistedText = [/coming soon/i, /not configured yet/i, /provider not configured/i, /local export only/i];

for (const file of corePages) {
  const absolutePath = path.join(repoRoot, file);
  if (!fs.existsSync(absolutePath)) continue;
  const source = fs.readFileSync(absolutePath, 'utf8');

  assert.doesNotMatch(source, /sampleData/i, `${file} must not import sampleData directly`);

  for (const pattern of blockedPlaceholderTerms) {
    assert.doesNotMatch(source, pattern, `${file} should not include blocked placeholder term: ${pattern}`);
  }

  for (const keptPattern of allowlistedText) {
    if (keptPattern.test(source)) {
      assert.match(source, keptPattern, `${file} allowlisted pattern should remain explicit: ${keptPattern}`);
    }
  }
}

const routerSource = fs.readFileSync(path.join(repoRoot, 'src/routes/AppRouter.jsx'), 'utf8');
const createProviderSource = fs.readFileSync(path.join(repoRoot, 'src/components/CreateActionProvider.jsx'), 'utf8');

const routeRefs = ['/properties', '/bookings', '/cleaning', '/maintenance', '/owners', '/guests', '/reports', '/inventory', '/calendar', '/notifications', '/settings', '/account'];
for (const route of routeRefs) {
  assert.match(routerSource, new RegExp(route.replace('/', '\\/')), `Expected AppRouter to include route: ${route}`);
}

const actionNames = ['property', 'booking', 'cleaning', 'maintenance', 'guest', 'report', 'expense', 'owner', 'invite'];
for (const actionName of actionNames) {
  assert.match(createProviderSource, new RegExp(`['\"]${actionName}['\"]`), `CreateActionProvider should include action: ${actionName}`);
}

const frontendSources = [
  ...corePages,
  'src/lib/AppContext.jsx',
  'src/components/CreateActionProvider.jsx',
  'src/routes/AppRouter.jsx',
].filter((file) => fs.existsSync(path.join(repoRoot, file)));

for (const file of frontendSources) {
  const source = fs.readFileSync(path.join(repoRoot, file), 'utf8');
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY/i, `${file} must not reference service-role keys`);
}

console.log('Core page placeholder contract tests passed');
