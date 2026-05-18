import { supabase, isSupabaseConfigured } from './supabase.js';

const SUPPLY_FIELDS = [
  'property_id',
  'item_name',
  'category',
  'current_quantity',
  'low_stock_threshold',
  'minimum_quantity',
  'unit',
  'supplier_name',
  'supplier_contact',
  'vendor_name',
  'vendor_contact',
  'estimated_unit_cost',
  'currency',
  'status',
  'notes',
  'archived_at',
  'created_by',
];

const TEXT_FIELDS = new Set([
  'property_id',
  'item_name',
  'category',
  'unit',
  'supplier_name',
  'supplier_contact',
  'vendor_name',
  'vendor_contact',
  'currency',
  'notes',
  'archived_at',
  'created_by',
]);
const NUMERIC_FIELDS = new Set(['current_quantity', 'low_stock_threshold', 'minimum_quantity', 'estimated_unit_cost']);
const STATUS_VALUES = new Set(['in_stock', 'low_stock', 'out_of_stock', 'archived']);
const CURRENCY_VALUES = new Set(['USD', 'JMD', 'CAD', 'GBP', 'EUR']);

function asText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function cleanNumber(value) {
  if (value === '' || value === null || value === undefined) return null;

  const numericValue = Number(String(value).replace(/,/g, '').trim());
  if (!Number.isFinite(numericValue)) return null;
  if (numericValue < 0) throw new Error('Supply quantity and cost values must be 0 or more.');
  return numericValue;
}

function normalizeStatus(value, payload = {}, { strict = false } = {}) {
  const rawStatus = asText(value)?.toLowerCase();
  if (rawStatus) {
    if (STATUS_VALUES.has(rawStatus)) return rawStatus;
    if (strict) throw new Error('Select a valid supply status.');
  }

  if (payload.archived_at) return 'archived';

  const currentQuantity = Number(payload.current_quantity ?? 0);
  const threshold = Number(payload.low_stock_threshold ?? payload.minimum_quantity ?? 0);

  if (Number.isFinite(currentQuantity) && currentQuantity <= 0) return 'out_of_stock';
  if (Number.isFinite(currentQuantity) && Number.isFinite(threshold) && currentQuantity <= threshold) return 'low_stock';
  return 'in_stock';
}

function requireWorkspaceId(workspaceId) {
  const cleanWorkspaceId = asText(workspaceId);
  if (!cleanWorkspaceId) {
    return {
      ok: false,
      result: {
        data: [],
        error: 'Select or create an active workspace before loading supplies.',
        code: 'missing_workspace_id',
      },
    };
  }

  return { ok: true, workspaceId: cleanWorkspaceId };
}

function notConfiguredResult(data = []) {
  return {
    data,
    error: null,
    code: 'supabase_not_configured',
    notConfigured: true,
    message: 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to load real supplies.',
  };
}

function userSafeError(error, fallback) {
  const code = error?.code || '';
  const message = String(error?.message || error || '').toLowerCase();

  if (code === 'PGRST116') return 'Supply not found.';
  if (code === '42501' || message.includes('row-level security') || message.includes('permission denied')) {
    return 'Your current workspace role cannot save this supply.';
  }
  if (message.includes('violates check constraint')) return 'Supply contains an unsupported value.';
  if (message.includes('violates not-null constraint') || message.includes('null value')) return 'Supply is missing required fields.';
  if (message.includes('failed to fetch') || message.includes('network')) return 'Network issue while saving supply. Check your connection and try again.';

  return fallback;
}

function pickAllowed(values = {}) {
  return SUPPLY_FIELDS.reduce((payload, key) => {
    if (Object.prototype.hasOwnProperty.call(values, key)) payload[key] = values[key];
    return payload;
  }, {});
}

export function normalizeSupply(row = null) {
  if (!row) return null;

  const lowStockThreshold = row.low_stock_threshold ?? row.minimum_quantity ?? row.lowStockThreshold ?? row.minimumQuantity ?? 0;
  const normalized = {
    ...row,
    workspace_id: row.workspace_id ?? row.workspaceId,
    property_id: row.property_id ?? row.propertyId ?? null,
    item_name: row.item_name ?? row.itemName ?? '',
    category: row.category || '',
    unit: row.unit || 'unit',
    current_quantity: row.current_quantity ?? row.currentQuantity ?? 0,
    low_stock_threshold: lowStockThreshold,
    minimum_quantity: row.minimum_quantity ?? lowStockThreshold,
    estimated_unit_cost: row.estimated_unit_cost ?? row.estimatedUnitCost ?? null,
    supplier_name: row.supplier_name ?? row.supplierName ?? row.vendor_name ?? row.vendorName ?? '',
    supplier_contact: row.supplier_contact ?? row.supplierContact ?? row.vendor_contact ?? row.vendorContact ?? '',
    vendor_name: row.vendor_name ?? row.vendorName ?? row.supplier_name ?? row.supplierName ?? '',
    vendor_contact: row.vendor_contact ?? row.vendorContact ?? row.supplier_contact ?? row.supplierContact ?? '',
    currency: row.currency || 'USD',
    notes: row.notes || '',
    archived_at: row.archived_at ?? row.archivedAt ?? null,
    last_updated_at: row.last_updated_at ?? row.lastUpdatedAt ?? row.updated_at ?? row.updatedAt ?? null,
    updated_at: row.updated_at ?? row.updatedAt ?? row.last_updated_at ?? row.lastUpdatedAt ?? null,
  };

  normalized.status = normalizeStatus(row.status, normalized);

  return {
    ...normalized,
    workspaceId: normalized.workspace_id,
    propertyId: normalized.property_id,
    itemName: normalized.item_name,
    currentQuantity: normalized.current_quantity,
    lowStockThreshold: normalized.low_stock_threshold,
    minimumQuantity: normalized.minimum_quantity,
    supplierName: normalized.supplier_name,
    supplierContact: normalized.supplier_contact,
    vendorName: normalized.vendor_name,
    vendorContact: normalized.vendor_contact,
    estimatedUnitCost: normalized.estimated_unit_cost,
    archivedAt: normalized.archived_at,
    lastUpdatedAt: normalized.last_updated_at,
    updatedAt: normalized.updated_at,
  };
}

export function buildSupplyPayload(values = {}) {
  const payload = pickAllowed(values);

  if ('itemName' in values && !('item_name' in payload)) payload.item_name = values.itemName;
  if ('propertyId' in values && !('property_id' in payload)) payload.property_id = values.propertyId;
  if ('currentQuantity' in values && !('current_quantity' in payload)) payload.current_quantity = values.currentQuantity;
  if ('lowStockThreshold' in values && !('low_stock_threshold' in payload)) payload.low_stock_threshold = values.lowStockThreshold;
  if ('minimumQuantity' in values && !('minimum_quantity' in payload)) payload.minimum_quantity = values.minimumQuantity;
  if ('supplierName' in values && !('supplier_name' in payload)) payload.supplier_name = values.supplierName;
  if ('supplierContact' in values && !('supplier_contact' in payload)) payload.supplier_contact = values.supplierContact;
  if ('vendorName' in values && !('vendor_name' in payload)) payload.vendor_name = values.vendorName;
  if ('vendorContact' in values && !('vendor_contact' in payload)) payload.vendor_contact = values.vendorContact;
  if ('estimatedUnitCost' in values && !('estimated_unit_cost' in payload)) payload.estimated_unit_cost = values.estimatedUnitCost;
  if ('archivedAt' in values && !('archived_at' in payload)) payload.archived_at = values.archivedAt;

  for (const key of Object.keys(payload)) {
    if (TEXT_FIELDS.has(key)) payload[key] = asText(payload[key]);
    if (NUMERIC_FIELDS.has(key)) payload[key] = cleanNumber(payload[key]);
  }

  if ('item_name' in payload && !payload.item_name) throw new Error('Item name is required.');
  if ('unit' in payload) payload.unit = payload.unit || 'unit';
  if ('currency' in payload) {
    payload.currency = String(payload.currency || 'USD').trim().toUpperCase();
    if (!CURRENCY_VALUES.has(payload.currency)) throw new Error('Currency must be USD, JMD, CAD, GBP, or EUR.');
  }

  if ('minimum_quantity' in payload && !('low_stock_threshold' in payload)) {
    payload.low_stock_threshold = payload.minimum_quantity;
  }
  delete payload.minimum_quantity;

  if ('status' in payload) payload.status = normalizeStatus(payload.status, payload, { strict: true });
  else if ('current_quantity' in payload || 'low_stock_threshold' in payload || 'archived_at' in payload) {
    payload.status = normalizeStatus(null, payload);
  }

  return payload;
}

export async function listSupplies({ workspaceId } = {}) {
  const w = requireWorkspaceId(workspaceId);
  if (!w.ok) return w.result;
  if (!isSupabaseConfigured || !supabase) return notConfiguredResult([]);

  const { data, error } = await supabase
    .from('supplies')
    .select('*')
    .eq('workspace_id', w.workspaceId)
    .order('created_at', { ascending: false });

  if (error) return { data: [], error: userSafeError(error, 'Supplies could not be loaded.'), code: error.code || 'supplies_load_failed' };
  return { data: (data || []).map(normalizeSupply), error: null, code: 'ok' };
}

export async function getSupplyById({ workspaceId, supplyId } = {}) {
  const w = requireWorkspaceId(workspaceId);
  if (!w.ok) return { ...w.result, data: null };
  const id = asText(supplyId);
  if (!id) return { data: null, error: 'Select a supply before loading details.', code: 'missing_supply_id' };
  if (!isSupabaseConfigured || !supabase) return notConfiguredResult(null);

  const { data, error } = await supabase.from('supplies').select('*').eq('workspace_id', w.workspaceId).eq('id', id).single();
  if (error) return { data: null, error: userSafeError(error, 'Supply not found.'), code: error.code || 'supply_load_failed' };
  return { data: normalizeSupply(data), error: null, code: 'ok' };
}

export async function createSupply({ workspaceId, userId, values } = {}) {
  const w = requireWorkspaceId(workspaceId);
  if (!w.ok) return { ...w.result, data: null };
  if (!isSupabaseConfigured || !supabase) return notConfiguredResult(null);

  let payload;
  try {
    payload = buildSupplyPayload(values);
  } catch (error) {
    return { data: null, error: error.message, code: 'invalid_supply_payload' };
  }

  payload.workspace_id = w.workspaceId;
  payload.created_by = asText(userId) || payload.created_by || null;

  const { data, error } = await supabase.from('supplies').insert(payload).select('*').single();
  if (error) return { data: null, error: userSafeError(error, 'Supply could not be saved.'), code: error.code || 'supply_insert_failed' };
  return { data: normalizeSupply(data), error: null, code: 'ok' };
}

export async function updateSupply({ workspaceId, supplyId, values } = {}) {
  const w = requireWorkspaceId(workspaceId);
  if (!w.ok) return { ...w.result, data: null };
  const id = asText(supplyId);
  if (!id) return { data: null, error: 'Select a supply before saving changes.', code: 'missing_supply_id' };
  if (!isSupabaseConfigured || !supabase) return notConfiguredResult(null);

  let payload;
  try {
    payload = buildSupplyPayload(values);
  } catch (error) {
    return { data: null, error: error.message, code: 'invalid_supply_payload' };
  }

  const { data, error } = await supabase.from('supplies').update(payload).eq('id', id).eq('workspace_id', w.workspaceId).select('*').single();
  if (error) return { data: null, error: userSafeError(error, 'Supply could not be updated.'), code: error.code || 'supply_update_failed' };
  return { data: normalizeSupply(data), error: null, code: 'ok' };
}
