import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const files = {
  dashboard: readFileSync(new URL('../src/pages/DashboardPage.jsx', import.meta.url), 'utf8'),
  onboarding: readFileSync(new URL('../src/pages/OnboardingPage.jsx', import.meta.url), 'utf8'),
  properties: readFileSync(new URL('../src/pages/PropertiesPage.jsx', import.meta.url), 'utf8'),
  bookings: readFileSync(new URL('../src/pages/BookingsPage.jsx', import.meta.url), 'utf8'),
  cleaning: readFileSync(new URL('../src/pages/CleaningPage.jsx', import.meta.url), 'utf8'),
  maintenance: readFileSync(new URL('../src/pages/MaintenancePage.jsx', import.meta.url), 'utf8'),
  owners: readFileSync(new URL('../src/pages/OwnersPage.jsx', import.meta.url), 'utf8'),
  guests: readFileSync(new URL('../src/pages/GuestsPage.jsx', import.meta.url), 'utf8'),
  inventory: readFileSync(new URL('../src/pages/InventoryPage.jsx', import.meta.url), 'utf8'),
  notifications: readFileSync(new URL('../src/pages/NotificationsPage.jsx', import.meta.url), 'utf8'),
  reports: readFileSync(new URL('../src/pages/ReportsPage.jsx', import.meta.url), 'utf8'),
  calendar: readFileSync(new URL('../src/pages/CalendarPage.jsx', import.meta.url), 'utf8'),
  cleanerDashboard: readFileSync(new URL('../src/pages/CleanerDashboardPage.jsx', import.meta.url), 'utf8'),
  maintenanceDashboard: readFileSync(new URL('../src/pages/MaintenanceDashboardPage.jsx', import.meta.url), 'utf8'),
  appLayout: readFileSync(new URL('../src/components/layout/AppLayout.jsx', import.meta.url), 'utf8'),
  createAction: readFileSync(new URL('../src/components/CreateActionProvider.jsx', import.meta.url), 'utf8'),
  mobileCss: readFileSync(new URL('../src/styles/mobile-responsiveness.css', import.meta.url), 'utf8'),
  globalCss: readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8'),
};

assert.match(files.dashboard, /stat-grid\s+dense\s+dashboard-kpi-grid/, 'Dashboard KPI grid should remain responsive-ready.');
assert.match(files.onboarding, /settings-checklist/, 'Onboarding checklist structure should exist for responsive stacking.');

['properties', 'bookings', 'owners', 'guests', 'reports'].forEach((page) => {
  assert.match(files[page], /DataTable/, `${page} should keep DataTable usage with table wrapper mobile handling.`);
});

assert.match(files.mobileCss, /\.table-wrap\s*\{[\s\S]*overflow-x:\s*auto/, 'Table wrappers should scroll horizontally on small screens.');
assert.match(files.mobileCss, /\.data-table\s*\{[\s\S]*min-width:\s*640px/, 'Data tables should enforce readable min-width on small screens.');
assert.match(files.mobileCss, /\.modal-panel\s*\{[\s\S]*max-height:\s*calc\(100dvh - 28px\)/, 'Create/edit modals must constrain height inside viewport.');
assert.match(files.globalCss, /\.modal-body\s*\{[\s\S]*overflow:\s*auto/, 'Modal body should be scrollable.');

['cleaner-dashboard-task-grid', 'maintenance-dashboard-job-grid', 'settings-checklist-item', 'calendar-layout-grid', 'reports-toolbar-actions'].forEach((token) => {
  assert.match(files.mobileCss, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `Mobile stylesheet should include ${token} handling.`);
});

const fixedWidthPatterns = [/\bw-\[[0-9]+px\]/, /min-w-\[[0-9]+px\]/, /\bstyle=\{\{\s*width:\s*['\"][0-9]+px/];
const corePageSources = [
  files.dashboard,
  files.onboarding,
  files.properties,
  files.bookings,
  files.cleaning,
  files.maintenance,
  files.owners,
  files.guests,
  files.inventory,
  files.notifications,
  files.reports,
  files.calendar,
  files.cleanerDashboard,
  files.maintenanceDashboard,
];
for (const pattern of fixedWidthPatterns) {
  for (const source of corePageSources) {
    assert.doesNotMatch(source, pattern, `Core pages should avoid hard fixed-width mobile-breaking patterns: ${pattern}`);
  }
}

assert.doesNotMatch(
  [
    files.dashboard,
    files.onboarding,
    files.properties,
    files.bookings,
    files.cleaning,
    files.maintenance,
    files.owners,
    files.guests,
    files.inventory,
    files.notifications,
    files.reports,
    files.calendar,
    files.createAction,
    files.appLayout,
  ].join('\n'),
  /SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY/i,
  'Frontend core workflow files must not reference service-role keys.',
);

console.log('Mobile responsiveness contract tests passed');
