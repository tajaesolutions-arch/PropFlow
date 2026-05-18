import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildOwnerReportPayload, buildWorkspaceReportData, createOwnerReport, listOwnerReports } from '../src/lib/reports.js';

const helperSource = readFileSync(new URL('../src/lib/reports.js', import.meta.url), 'utf8');
const frontendSource = readFileSync(new URL('../src/pages/ReportsPage.jsx', import.meta.url), 'utf8');

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
assert.doesNotMatch(frontendSource, /SERVICE[_-]?ROLE/i, 'frontend reports page must not reference service role keys');

console.log('Reports data-access tests passed');
