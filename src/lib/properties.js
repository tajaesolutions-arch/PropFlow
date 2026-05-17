import { supabase, isSupabaseConfigured } from './supabase.js';
import { currencies, propertyStatuses, propertyTypes, rentalTypes } from '../data/constants.js';

const PROPERTY_FIELDS = [
  'name',
  'address',
  'city',
  'state',
  'country',
  'property_type',
  'rental_type',
  'currency',
  'status',
  'nightly_rate',
  'monthly_rent',
  'assigned_owner_id',
  'bedrooms',
  'bathrooms',
  'square_feet',
  'notes',
  'archived_at',
  'created_by',
];

const NUMERIC_FIELDS = new Set(['nightly_rate', 'monthly_rent', 'bedrooms', 'bathrooms', 'square_feet']);
const TEXT_FIELDS = new Set(['name', 'address', 'city', 'state', 'country', 'notes']);
const NULLABLE_FIELDS = new Set([
  'address',
  'city',
  'state',
  'country',
  'nightly_rate',
  'monthly_rent',
  'assigned_owner_id',
  'bedrooms',
  'bathrooms',
  'square_feet',
  'notes',
  'archived_at',
  'created_by',
]);

function asText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function cleanNumber(value) {
  if (value === '' || value === null || value === undefined) return null;

  const numericValue = Number(String(value).replace(/,/g, '').trim());
  if (!Number.isFinite(numericValue)) return null;
  if (numericValue < 0) throw new Error('Numeric property values must be 0 or more.');
  return numericValue;
}

function requireWorkspaceId(workspaceId) {
  const cleanWorkspaceId = asText(workspaceId);
  if (!cleanWorkspaceId) {
    return {
      ok: false,
      result: {
        data: [],
        error: 'Select or create an active workspace before loading properties.',
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
    message: 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to load real properties.',
  };
}

function userSafeError(error, fallback) {
  const code = error?.code || '';
  const message = String(error?.message || error || '').toLowerCase();

  if (code === 'PGRST116') return 'Property not found.';
  if (code === '42501' || message.includes('row-level security') || message.includes('permission denied')) {
    return 'Your current workspace role cannot save this property.';
  }
  if (message.includes('violates check constraint')) return 'Property contains an unsupported value.';
  if (message.includes('violates not-null constraint') || message.includes('null value')) return 'Property is missing required fields.';
  if (message.includes('failed to fetch') || message.includes('network')) return 'Network issue while saving property. Check your connection and try again.';

  return fallback;
}

function pickAllowed(values = {}) {
  return PROPERTY_FIELDS.reduce((payload, key) => {
    if (Object.prototype.hasOwnProperty.call(values, key)) payload[key] = values[key];
    return payload;
  }, {});
}

export function normalizeProperty(row = null) {
  if (!row) return null;

  const normalized = {
    ...row,
    name: row.name || '',
    address: row.address || '',
    city: row.city || '',
    state: row.state || '',
    country: row.country || '',
    property_type: row.property_type || row.propertyType || 'short_term_rental',
    rental_type: row.rental_type || row.rentalType || 'short_term',
    currency: row.currency || 'USD',
    status: row.status || 'active',
    nightly_rate: row.nightly_rate ?? row.nightlyRate ?? null,
    monthly_rent: row.monthly_rent ?? row.monthlyRent ?? null,
    square_feet: row.square_feet ?? row.squareFeet ?? null,
    assigned_owner_id: row.assigned_owner_id ?? row.assignedOwnerId ?? null,
    archived_at: row.archived_at ?? row.archivedAt ?? null,
    notes: row.notes || '',
  };

  return {
    ...normalized,
    propertyType: normalized.property_type,
    rentalType: normalized.rental_type,
    nightlyRate: normalized.nightly_rate,
    monthlyRent: normalized.monthly_rent,
    squareFeet: normalized.square_feet,
    assignedOwnerId: normalized.assigned_owner_id,
    archivedAt: normalized.archived_at,
  };
}

export function buildPropertyPayload(values = {}, { requireRequiredFields = false } = {}) {
  const payload = pickAllowed(values);

  Object.keys(payload).forEach((key) => {
    if (TEXT_FIELDS.has(key)) payload[key] = asText(payload[key]);
    if (NUMERIC_FIELDS.has(key)) payload[key] = cleanNumber(payload[key]);
    if (NULLABLE_FIELDS.has(key) && payload[key] === '') payload[key] = null;
  });

  if ('assigned_owner_id' in payload) payload.assigned_owner_id = asText(payload.assigned_owner_id);
  if ('created_by' in payload) payload.created_by = asText(payload.created_by);

  if (requireRequiredFields) {
    if (!payload.name) throw new Error('Property name is required.');
    if (!payload.address) throw new Error('Address or location is required.');
  }

  if ('property_type' in payload && !propertyTypes.includes(payload.property_type)) {
    throw new Error('Select a valid property type.');
  }

  if ('rental_type' in payload && !rentalTypes.includes(payload.rental_type)) {
    throw new Error('Select a valid rental type.');
  }

  if ('currency' in payload && !currencies.includes(payload.currency)) {
    throw new Error('Select a valid currency.');
  }

  if ('status' in payload && !propertyStatuses.includes(payload.status)) {
    throw new Error('Select a valid property status.');
  }

  return payload;
}

export async function listProperties({ workspaceId } = {}) {
  const workspace = requireWorkspaceId(workspaceId);
  if (!workspace.ok) return workspace.result;
  if (!isSupabaseConfigured || !supabase) return notConfiguredResult([]);

  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('workspace_id', workspace.workspaceId)
    .order('created_at', { ascending: false });

  if (error) {
    return {
      data: [],
      error: userSafeError(error, 'Properties could not be loaded.'),
      code: error.code || 'properties_load_failed',
    };
  }

  return { data: (data || []).map(normalizeProperty), error: null, code: 'ok' };
}

export async function getPropertyById({ workspaceId, propertyId } = {}) {
  const workspace = requireWorkspaceId(workspaceId);
  if (!workspace.ok) return { ...workspace.result, data: null };

  const cleanPropertyId = asText(propertyId);
  if (!cleanPropertyId) {
    return { data: null, error: 'Select a property before loading details.', code: 'missing_property_id' };
  }

  if (!isSupabaseConfigured || !supabase) return notConfiguredResult(null);

  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('workspace_id', workspace.workspaceId)
    .eq('id', cleanPropertyId)
    .single();

  if (error) {
    return {
      data: null,
      error: userSafeError(error, 'Property not found.'),
      code: error.code || 'property_load_failed',
    };
  }

  return { data: normalizeProperty(data), error: null, code: 'ok' };
}

export async function createProperty({ workspaceId, values } = {}) {
  const workspace = requireWorkspaceId(workspaceId);
  if (!workspace.ok) return { ...workspace.result, data: null };
  if (!isSupabaseConfigured || !supabase) return notConfiguredResult(null);

  let payload;
  try {
    payload = buildPropertyPayload(values, { requireRequiredFields: true });
  } catch (error) {
    return { data: null, error: error.message, code: 'invalid_property_payload' };
  }

  payload.workspace_id = workspace.workspaceId;

  const { data, error } = await supabase
    .from('properties')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    return {
      data: null,
      error: userSafeError(error, 'Property could not be saved.'),
      code: error.code || 'property_insert_failed',
    };
  }

  return { data: normalizeProperty(data), error: null, code: 'ok' };
}

export async function updateProperty({ workspaceId, propertyId, values } = {}) {
  const workspace = requireWorkspaceId(workspaceId);
  if (!workspace.ok) return { ...workspace.result, data: null };

  const cleanPropertyId = asText(propertyId);
  if (!cleanPropertyId) {
    return { data: null, error: 'Select a property before saving changes.', code: 'missing_property_id' };
  }

  if (!isSupabaseConfigured || !supabase) return notConfiguredResult(null);

  let payload;
  try {
    payload = buildPropertyPayload(values);
  } catch (error) {
    return { data: null, error: error.message, code: 'invalid_property_payload' };
  }

  const { data, error } = await supabase
    .from('properties')
    .update(payload)
    .eq('id', cleanPropertyId)
    .eq('workspace_id', workspace.workspaceId)
    .select('*')
    .single();

  if (error) {
    return {
      data: null,
      error: userSafeError(error, 'Property could not be updated.'),
      code: error.code || 'property_update_failed',
    };
  }

  return { data: normalizeProperty(data), error: null, code: 'ok' };
}
