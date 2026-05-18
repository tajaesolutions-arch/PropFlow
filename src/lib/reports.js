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

function calculateSummary({ properties = [], bookings = [], cleaning = [], maintenance = [] } = {}) {
  const bookingCount = bookings.length;
  const grossRevenue = bookings.reduce((sum, b) => sum + toNumber(b.totalAmount ?? b.total_amount), 0);
  const ownerPayout = bookings.reduce((sum, b) => sum + toNumber(b.ownerPayout ?? b.owner_payout), 0);
  const maintenanceCosts = maintenance.reduce((sum, m) => sum + toNumber(m.actualCost ?? m.actual_cost ?? m.estimatedCost ?? m.estimated_cost), 0);
  const cleaningCost = cleaning.reduce((sum, c) => sum + toNumber(c.actualCost ?? c.actual_cost ?? c.estimatedCost ?? c.estimated_cost ?? c.cleaningFee ?? c.cleaning_fee), 0);
  const expenses = maintenanceCosts + cleaningCost;
  const bookedNights = bookings.reduce((sum, b) => sum + getBookingNights(b), 0);
  const availableNights = Math.max(properties.length * 30, 0);
  const occupancy = availableNights ? Math.min((bookedNights / availableNights) * 100, 100) : 0;
  return { grossRevenue, expenses, maintenanceCosts, cleaningTaskCount: cleaning.length, cleaningCost, netProfit: grossRevenue - expenses, occupancyEstimate: occupancy, bookingCount, ownerPayout };
}

export async function buildWorkspaceReportData({ workspaceId } = {}) {
  const w = requireWorkspaceId(workspaceId); if (!w.ok) return w.result;
  const [propertiesResult, bookingsResult, cleaningResult, maintenanceResult, ownersResult] = await Promise.all([
    listProperties({ workspaceId: w.workspaceId }), listBookings({ workspaceId: w.workspaceId }), listCleaningTasks({ workspaceId: w.workspaceId }), listMaintenanceWorkOrders({ workspaceId: w.workspaceId }), listOwners({ workspaceId: w.workspaceId }),
  ]);
  const properties = propertiesResult.data || [];
  const bookings = bookingsResult.data || [];
  const cleaning = cleaningResult.data || [];
  const maintenance = maintenanceResult.data || [];
  const owners = ownersResult.data || [];
  const summary = calculateSummary({ properties, bookings, cleaning, maintenance });
  const propertyPerformance = properties.map((property) => {
    const propertyBookings = bookings.filter((b) => getPropertyId(b) === property.id);
    const propertyCleaning = cleaning.filter((c) => getPropertyId(c) === property.id);
    const propertyMaintenance = maintenance.filter((m) => getPropertyId(m) === property.id);
    return { propertyId: property.id, propertyName: property.name || 'Property', ...calculateSummary({ properties: [property], bookings: propertyBookings, cleaning: propertyCleaning, maintenance: propertyMaintenance }) };
  });
  return { data: { summary, propertyPerformance, owners }, error: null, code: 'ok' };
}

export async function buildOwnerReportData({ workspaceId, ownerId } = {}) {
  const workspace = requireWorkspaceId(workspaceId); if (!workspace.ok) return workspace.result;
  const owner = asText(ownerId); if (!owner) return { data: null, error: 'Select an owner before loading owner report data.', code: 'missing_owner_id' };
  const workspaceData = await buildWorkspaceReportData({ workspaceId: workspace.workspaceId });
  if (workspaceData.error) return workspaceData;
  const ownerProperties = (workspaceData.data.propertyPerformance || []).filter((p) => {
    const ownerRow = (workspaceData.data.owners || []).find((o) => o.id === owner);
    return ownerRow?.assigned_property_ids?.includes(p.propertyId);
  });
  return { data: { ownerId: owner, summary: ownerProperties.reduce((agg, row) => ({ grossRevenue: agg.grossRevenue + row.grossRevenue, expenses: agg.expenses + row.expenses, maintenanceCosts: agg.maintenanceCosts + row.maintenanceCosts, cleaningTaskCount: agg.cleaningTaskCount + row.cleaningTaskCount, cleaningCost: agg.cleaningCost + row.cleaningCost, netProfit: agg.netProfit + row.netProfit, bookingCount: agg.bookingCount + row.bookingCount, ownerPayout: agg.ownerPayout + row.ownerPayout, occupancyEstimate: ownerProperties.length ? (agg.occupancyEstimate + row.occupancyEstimate / ownerProperties.length) : 0 }), { grossRevenue: 0, expenses: 0, maintenanceCosts: 0, cleaningTaskCount: 0, cleaningCost: 0, netProfit: 0, occupancyEstimate: 0, bookingCount: 0, ownerPayout: 0 }), propertyPerformance: ownerProperties }, error: null, code: 'ok' };
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
