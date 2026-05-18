import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildOwnerReportData, buildOwnerReportPayload, buildWorkspaceReportData, buildWorkspaceReportDataFromRecords, createOwnerReport, listOwnerReports } from '../src/lib/reports.js';

const helperSource = readFileSync(new URL('../src/lib/reports.js', import.meta.url), 'utf8');
const frontendSource = readFileSync(new URL('../src/pages/ReportsPage.jsx', import.meta.url), 'utf8');
const ownerDashboardSource = readFileSync(new URL('../src/pages/OwnerDashboardPage.jsx', import.meta.url), 'utf8');

const missingWorkspace = await buildWorkspaceReportData({});
assert.equal(missingWorkspace.code, 'missing_workspace_id');

const notConfiguredList = await listOwnerReports({ workspaceId: 'workspace-1' });
assert.equal(notConfiguredList.notConfigured, true);
assert.deepEqual(notConfiguredList.data, []);

const notConfiguredCreate = await createOwnerReport({ workspaceId: 'workspace-1', userId: 'user-1', values: { title: 'April' } });
assert.equal(notConfiguredCreate.notConfigured, true);

const workspaceData = await buildWorkspaceReportData({ workspaceId: 'workspace-1' });
assert.equal(workspaceData.code, 'ok');
assert.equal(workspaceData.data.summary.grossRevenue, 0);
assert.equal(workspaceData.data.summary.netProfit, 0);
assert.equal(workspaceData.data.summary.bookingCount, 0);


const emptyRecordsData = buildWorkspaceReportDataFromRecords({ properties: [], bookings: [], cleaningTasks: [], maintenanceWorkOrders: [], expenses: [] });
assert.equal(emptyRecordsData.summary.grossRevenue, 0);
assert.equal(emptyRecordsData.summary.expenses, 0);
assert.equal(emptyRecordsData.summary.netProfit, 0);
assert.deepEqual(emptyRecordsData.propertyPerformance, []);

const scopedRecordsData = buildWorkspaceReportDataFromRecords({
  properties: [{ id: 'property-1', name: 'Owner Cabin', assignedOwnerId: 'owner-1' }, { id: 'property-2', name: 'Other Cabin', assignedOwnerId: 'owner-2' }],
  bookings: [{ propertyId: 'property-1', totalAmount: 1200, ownerPayout: 800, checkIn: '2026-05-01', checkOut: '2026-05-04' }, { propertyId: 'property-2', totalAmount: 900, ownerPayout: 600 }],
  cleaningTasks: [{ propertyId: 'property-1', actualCost: 150 }],
  maintenanceWorkOrders: [{ propertyId: 'property-1', estimatedCost: 250, status: 'reported' }],
  expenses: [{ propertyId: 'property-1', amount: 100 }],
  ownerId: 'owner-1',
});
assert.equal(scopedRecordsData.summary.grossRevenue, 1200);
assert.equal(scopedRecordsData.summary.expenses, 500);
assert.equal(scopedRecordsData.summary.netProfit, 700);
assert.equal(scopedRecordsData.summary.ownerPayout, 800);
assert.equal(scopedRecordsData.summary.cleaningTaskCount, 1);
assert.equal(scopedRecordsData.summary.maintenanceCosts, 250);
assert.equal(scopedRecordsData.propertyPerformance.length, 1);
assert.equal(scopedRecordsData.propertyPerformance[0].propertyId, 'property-1');

const ownerReportData = buildOwnerReportData({
  ownerId: 'owner-1',
  records: {
    properties: [{ id: 'property-1', name: 'Owner Cabin', assignedOwnerId: 'owner-1' }, { id: 'property-2', name: 'Other Cabin', assignedOwnerId: 'owner-2' }],
    bookings: [{ propertyId: 'property-1', totalAmount: 1200, ownerPayout: 800, checkIn: '2026-05-01', checkOut: '2026-05-04' }, { propertyId: 'property-2', totalAmount: 900, ownerPayout: 600 }],
    cleaningTasks: [{ propertyId: 'property-1', actualCost: 150 }],
    maintenanceWorkOrders: [{ propertyId: 'property-1', estimatedCost: 250, status: 'reported' }],
    expenses: [{ propertyId: 'property-1', amount: 100 }],
  },
});
assert.equal(ownerReportData.code, 'ok');
assert.equal(ownerReportData.data.summary.grossRevenue, 1200);
assert.equal(ownerReportData.data.propertyPerformance.length, 1);

const payload = buildOwnerReportPayload({
  title: '  April Owner Statement  ',
  report_type: ' owner_report ',
  notes: '  ready to review ',
  start_date: '2026-04-01',
  end_date: '2026-04-30',
});
assert.equal(payload.title, 'April Owner Statement');
assert.equal(payload.report_type, 'owner_report');
assert.equal(payload.notes, 'ready to review');

assert.match(helperSource, /\.eq\('workspace_id',\s*w\.workspaceId\)/, 'reports helper reads/writes must scope by workspace_id');
assert.doesNotMatch(helperSource, /createClient|SERVICE[_-]?ROLE/i, 'reports helper must not create duplicate clients or reference service role keys');
assert.match(frontendSource, /buildWorkspaceReportDataFromRecords/, 'ReportsPage must use the shared reports helper record contract');
assert.match(ownerDashboardSource, /buildOwnerReportData/, 'OwnerDashboard must use owner-scoped shared report data');
assert.doesNotMatch(frontendSource, /function buildPropertyRows/, 'ReportsPage should not keep duplicate property performance derivation');
assert.doesNotMatch(ownerDashboardSource, /function buildOwnerPropertyRows/, 'OwnerDashboard should not keep duplicate owner financial derivation');
assert.doesNotMatch(frontendSource, /SERVICE[_-]?ROLE/i, 'frontend reports page must not reference service role keys');
assert.doesNotMatch(ownerDashboardSource, /SERVICE[_-]?ROLE/i, 'owner dashboard must not reference service role keys');

console.log('Reports data-access tests passed');
