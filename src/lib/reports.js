import { isSupabaseConfigured, supabase } from './supabase.js';
import { listProperties } from './properties.js';
import { listBookings } from './bookings.js';
import { listCleaningTasks } from './cleaningTasks.js';
import { listMaintenanceWorkOrders } from './maintenanceWorkOrders.js';
import { listOwners } from './owners.js';

const asText = (v) => { const t = String(v ?? '').trim(); return t || null; };
const toNumber = (v) => { const n = Number(String(v ?? 0).replace(/,/g, '').replace(/[^\d.-]/g, '').trim()); return Number.isFinite(n) ? n : 0; };
const toDate = (v) => { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; };

function requireWorkspaceId(workspaceId) {
  const clean = asText(workspaceId);
  if (!clean) return { ok: false, result: { data: null, error: 'Select or create an active workspace before loading reports.', code: 'missing_workspace_id' } };
  return { ok: true, workspaceId: clean };
}

function daysBetween(start, end) { const a = toDate(start); const b = toDate(end); if (!a || !b || b <= a) return 0; return Math.ceil((b - a) / 86400000); }
function getBookingNights(b) { return daysBetween(b.checkIn || b.check_in, b.checkOut || b.check_out); }
function getPropertyId(row) { return row?.propertyId || row?.property_id; }

export function normalizeOwnerReport(row = null) {
  if (!row) return null;
  return { ...row, reportType: row.report_type || row.reportType || 'owner_report', startDate: row.start_date || row.startDate || null, endDate: row.end_date || row.endDate || null, ownerId: row.owner_id || row.ownerId || null, contactId: row.contact_id || row.contactId || null, summaryData: row.summary_data || row.summaryData || {} };
}

export function buildOwnerReportPayload(values = {}) {
  const payload = {
    title: asText(values.title) || 'Owner report',
    report_type: asText(values.report_type || values.reportType) || 'owner_report',
    status: asText(values.status) || 'draft',
    summary: asText(values.summary),
    notes: asText(values.notes),
    owner_id: asText(values.owner_id || values.ownerId),
    contact_id: asText(values.contact_id || values.contactId),
    property_id: asText(values.property_id || values.propertyId),
    start_date: asText(values.start_date || values.startDate),
    end_date: asText(values.end_date || values.endDate),
    summary_data: typeof values.summary_data === 'object' && values.summary_data ? values.summary_data : {},
  };
  if (payload.end_date && payload.start_date && payload.end_date < payload.start_date) throw new Error('Report end date must be on or after start date.');
  return payload;
}

function calculateSummary({ properties = [], bookings = [], cleaning = [], maintenance = [], expenses = [] } = {}) {
  const safeProperties = Array.isArray(properties) ? properties : [];
  const safeBookings = Array.isArray(bookings) ? bookings : [];
  const safeCleaning = Array.isArray(cleaning) ? cleaning : [];
  const safeMaintenance = Array.isArray(maintenance) ? maintenance : [];
  const safeExpenses = Array.isArray(expenses) ? expenses : [];
  const bookingCount = safeBookings.length;
  const grossRevenue = safeBookings.reduce((sum, b) => sum + toNumber(b.totalAmount ?? b.total_amount ?? b.amount ?? b.revenue), 0);
  const ownerPayout = safeBookings.reduce((sum, b) => sum + toNumber(b.ownerPayout ?? b.owner_payout), 0);
  const maintenanceCosts = safeMaintenance.reduce((sum, m) => sum + toNumber(m.actualCost ?? m.actual_cost ?? m.estimatedCost ?? m.estimated_cost), 0);
  const cleaningCost = safeCleaning.reduce((sum, c) => sum + toNumber(c.actualCost ?? c.actual_cost ?? c.estimatedCost ?? c.estimated_cost ?? c.cleaningFee ?? c.cleaning_fee), 0);
  const manualExpenses = safeExpenses.reduce((sum, e) => sum + toNumber(e.amount ?? e.totalAmount ?? e.total_amount), 0);
  const expensesTotal = maintenanceCosts + cleaningCost + manualExpenses;
  const bookedNights = safeBookings.reduce((sum, b) => sum + getBookingNights(b), 0);
  const availableNights = Math.max(safeProperties.length * 30, 0);
  const occupancy = availableNights ? Math.min((bookedNights / availableNights) * 100, 100) : 0;
  return {
    grossRevenue,
    expenses: expensesTotal,
    manualExpenses,
    maintenanceCosts,
    cleaningTaskCount: safeCleaning.length,
    maintenanceItemCount: safeMaintenance.length,
    cleaningCost,
    netProfit: grossRevenue - expensesTotal,
    occupancyEstimate: occupancy,
    bookingCount,
    bookedNights,
    availableNights,
    ownerPayout,
  };
}

function getOwnerAssignedPropertyIds(ownerId, owners = []) {
  const owner = asText(ownerId);
  if (!owner) return new Set();
  const ownerRow = (Array.isArray(owners) ? owners : []).find((row) => row.id === owner || row.user_id === owner || row.userId === owner || row.contact_id === owner || row.contactId === owner);
  const assignedIds = ownerRow?.assigned_property_ids || ownerRow?.assignedPropertyIds || ownerRow?.property_ids || ownerRow?.propertyIds || [];
  return new Set(Array.isArray(assignedIds) ? assignedIds : []);
}

function isOwnerAssignedProperty(property, ownerId, owners = []) {
  const owner = asText(ownerId);
  if (!owner) return true;
  const directOwnerId = property?.assignedOwnerId || property?.assigned_owner_id || property?.ownerId || property?.owner_id;
  if (directOwnerId) return directOwnerId === owner;
  return getOwnerAssignedPropertyIds(owner, owners).has(property?.id);
}

function normalizePropertyPerformanceRow(property, summary, openMaintenanceCount = 0) {
  const propertyName = property?.name || property?.address || 'Property';
  return {
    propertyId: property?.id,
    propertyName,
    id: property?.id,
    name: propertyName,
    currency: property?.currency,
    revenue: summary.grossRevenue,
    ownerPayout: summary.ownerPayout,
    maintenanceCost: summary.maintenanceCosts,
    cleaningTasks: summary.cleaningTaskCount,
    occupancy: summary.occupancyEstimate,
    bookings: summary.bookingCount,
    maintenanceItems: summary.maintenanceItemCount || 0,
    openMaintenance: openMaintenanceCount,
    ...summary,
  };
}

export function buildWorkspaceReportDataFromRecords({ properties = [], bookings = [], cleaningTasks = [], cleaning = cleaningTasks, maintenanceWorkOrders = [], maintenance = maintenanceWorkOrders, expenses = [], owners = [], propertyIds = null, ownerId = null } = {}) {
  const safeProperties = (Array.isArray(properties) ? properties : [])
    .filter((property) => property?.status !== 'archived')
    .filter((property) => !ownerId || isOwnerAssignedProperty(property, ownerId, owners));
  const allowedPropertyIds = new Set(Array.isArray(propertyIds) ? propertyIds : safeProperties.map((property) => property.id));
  const scopedProperties = safeProperties.filter((property) => allowedPropertyIds.has(property.id));
  const scopedBookings = (Array.isArray(bookings) ? bookings : []).filter((row) => allowedPropertyIds.has(getPropertyId(row)));
  const scopedCleaning = (Array.isArray(cleaning) ? cleaning : []).filter((row) => allowedPropertyIds.has(getPropertyId(row)));
  const scopedMaintenance = (Array.isArray(maintenance) ? maintenance : []).filter((row) => allowedPropertyIds.has(getPropertyId(row)));
  const scopedExpenses = (Array.isArray(expenses) ? expenses : []).filter((row) => allowedPropertyIds.has(getPropertyId(row)));
  const summary = calculateSummary({ properties: scopedProperties, bookings: scopedBookings, cleaning: scopedCleaning, maintenance: scopedMaintenance, expenses: scopedExpenses });
  const propertyPerformance = scopedProperties.map((property) => {
    const propertyBookings = scopedBookings.filter((b) => getPropertyId(b) === property.id);
    const propertyCleaning = scopedCleaning.filter((c) => getPropertyId(c) === property.id);
    const propertyMaintenance = scopedMaintenance.filter((m) => getPropertyId(m) === property.id);
    const propertyExpenses = scopedExpenses.filter((e) => getPropertyId(e) === property.id);
    const propertySummary = calculateSummary({ properties: [property], bookings: propertyBookings, cleaning: propertyCleaning, maintenance: propertyMaintenance, expenses: propertyExpenses });
    const openMaintenanceCount = propertyMaintenance.filter((item) => !['completed', 'cancelled'].includes(String(item.status || '').toLowerCase())).length;
    return normalizePropertyPerformanceRow(property, propertySummary, openMaintenanceCount);
  }).sort((a, b) => b.grossRevenue - a.grossRevenue);
  return { summary, propertyPerformance, owners: Array.isArray(owners) ? owners : [] };
}

export async function buildWorkspaceReportData({ workspaceId } = {}) {
  const w = requireWorkspaceId(workspaceId); if (!w.ok) return w.result;
  const [propertiesResult, bookingsResult, cleaningResult, maintenanceResult, ownersResult] = await Promise.all([
    listProperties({ workspaceId: w.workspaceId }), listBookings({ workspaceId: w.workspaceId }), listCleaningTasks({ workspaceId: w.workspaceId }), listMaintenanceWorkOrders({ workspaceId: w.workspaceId }), listOwners({ workspaceId: w.workspaceId }),
  ]);
  const reportData = buildWorkspaceReportDataFromRecords({
    properties: propertiesResult.data || [],
    bookings: bookingsResult.data || [],
    cleaningTasks: cleaningResult.data || [],
    maintenanceWorkOrders: maintenanceResult.data || [],
    owners: ownersResult.data || [],
  });
  return { data: reportData, error: null, code: 'ok' };
}


function summarizePerformanceRows(rows = []) {
  const safeRows = Array.isArray(rows) ? rows : [];
  return safeRows.reduce((agg, row, index) => ({
    grossRevenue: agg.grossRevenue + toNumber(row.grossRevenue ?? row.revenue),
    expenses: agg.expenses + toNumber(row.expenses),
    manualExpenses: agg.manualExpenses + toNumber(row.manualExpenses),
    maintenanceCosts: agg.maintenanceCosts + toNumber(row.maintenanceCosts ?? row.maintenanceCost),
    cleaningTaskCount: agg.cleaningTaskCount + toNumber(row.cleaningTaskCount ?? row.cleaningTasks),
    maintenanceItemCount: agg.maintenanceItemCount + toNumber(row.maintenanceItemCount ?? row.maintenanceItems),
    cleaningCost: agg.cleaningCost + toNumber(row.cleaningCost),
    netProfit: agg.netProfit + toNumber(row.netProfit),
    occupancyEstimate: safeRows.length ? agg.occupancyEstimate + (toNumber(row.occupancyEstimate ?? row.occupancy) / safeRows.length) : 0,
    bookingCount: agg.bookingCount + toNumber(row.bookingCount ?? row.bookings),
    bookedNights: agg.bookedNights + toNumber(row.bookedNights),
    availableNights: agg.availableNights + toNumber(row.availableNights || 30),
    ownerPayout: agg.ownerPayout + toNumber(row.ownerPayout),
  }), { grossRevenue: 0, expenses: 0, manualExpenses: 0, maintenanceCosts: 0, cleaningTaskCount: 0, maintenanceItemCount: 0, cleaningCost: 0, netProfit: 0, occupancyEstimate: 0, bookingCount: 0, bookedNights: 0, availableNights: 0, ownerPayout: 0 });
}

function buildOwnerReportDataFromRecords({ ownerId, records = {}, ...directRecords } = {}) {
  const owner = asText(ownerId);
  const source = { ...records, ...directRecords };
  if (Array.isArray(source.propertyPerformance) && !source.properties) {
    const assignedPropertyIds = getOwnerAssignedPropertyIds(owner, source.owners);
    const propertyPerformance = source.propertyPerformance.filter((row) => !assignedPropertyIds.size || assignedPropertyIds.has(row.propertyId || row.id));
    return { ownerId: owner, summary: summarizePerformanceRows(propertyPerformance), propertyPerformance };
  }
  const reportData = buildWorkspaceReportDataFromRecords({ ...source, ownerId: owner });
  return {
    ownerId: owner,
    summary: reportData.summary,
    propertyPerformance: reportData.propertyPerformance,
  };
}

async function buildOwnerReportDataFromSupabase({ workspaceId, ownerId } = {}) {
  const workspace = requireWorkspaceId(workspaceId); if (!workspace.ok) return workspace.result;
  const owner = asText(ownerId); if (!owner) return { data: null, error: 'Select an owner before loading owner report data.', code: 'missing_owner_id' };
  const workspaceData = await buildWorkspaceReportData({ workspaceId: workspace.workspaceId });
  if (workspaceData.error) return workspaceData;
  const ownerData = buildOwnerReportDataFromRecords({ ownerId: owner, records: workspaceData.data });
  return { data: ownerData, error: null, code: 'ok' };
}

export function buildOwnerReportData(options = {}) {
  const hasRecordInput = Boolean(options.records || options.properties || options.bookings || options.cleaningTasks || options.cleaning || options.maintenanceWorkOrders || options.maintenance || options.expenses);
  if (hasRecordInput) {
    const owner = asText(options.ownerId);
    if (!owner) return { data: null, error: 'Select an owner before loading owner report data.', code: 'missing_owner_id' };
    return { data: buildOwnerReportDataFromRecords(options), error: null, code: 'ok' };
  }
  return buildOwnerReportDataFromSupabase(options);
}

export async function listOwnerReports({ workspaceId } = {}) {
  const w = requireWorkspaceId(workspaceId); if (!w.ok) return { data: [], error: w.result.error, code: w.result.code };
  if (!isSupabaseConfigured || !supabase) return { data: [], error: null, code: 'supabase_not_configured', notConfigured: true };
  const { data, error } = await supabase.from('owner_reports').select('*').eq('workspace_id', w.workspaceId).order('created_at', { ascending: false });
  if (error) return { data: [], error: error.message || 'Owner reports could not be loaded.', code: error.code || 'owner_reports_load_failed' };
  return { data: (data || []).map(normalizeOwnerReport), error: null, code: 'ok' };
}

export async function createOwnerReport({ workspaceId, userId, values } = {}) {
  const w = requireWorkspaceId(workspaceId); if (!w.ok) return w.result;
  if (!isSupabaseConfigured || !supabase) return { data: null, error: null, code: 'supabase_not_configured', notConfigured: true };
  let payload; try { payload = buildOwnerReportPayload(values); } catch (error) { return { data: null, error: error.message, code: 'invalid_owner_report_payload' }; }
  payload.workspace_id = w.workspaceId; payload.created_by = asText(userId) || null;
  const { data, error } = await supabase.from('owner_reports').insert(payload).select('*').single();
  if (error) return { data: null, error: error.message || 'Owner report could not be saved.', code: error.code || 'owner_report_insert_failed' };
  return { data: normalizeOwnerReport(data), error: null, code: 'ok' };
}

export async function updateOwnerReport({ workspaceId, reportId, values } = {}) {
  const w = requireWorkspaceId(workspaceId); if (!w.ok) return w.result;
  const id = asText(reportId); if (!id) return { data: null, error: 'Select an owner report before saving changes.', code: 'missing_report_id' };
  if (!isSupabaseConfigured || !supabase) return { data: null, error: null, code: 'supabase_not_configured', notConfigured: true };
  let payload; try { payload = buildOwnerReportPayload(values); } catch (error) { return { data: null, error: error.message, code: 'invalid_owner_report_payload' }; }
  const { data, error } = await supabase.from('owner_reports').update(payload).eq('id', id).eq('workspace_id', w.workspaceId).select('*').single();
  if (error) return { data: null, error: error.message || 'Owner report could not be updated.', code: error.code || 'owner_report_update_failed' };
  return { data: normalizeOwnerReport(data), error: null, code: 'ok' };
}
