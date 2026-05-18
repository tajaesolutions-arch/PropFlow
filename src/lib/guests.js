import { isSupabaseConfigured, supabase } from './supabase.js';

const GUEST_FIELDS = [
  'full_name',
  'email',
  'phone',
  'country',
  'location',
  'notes',
  'tags',
  'status',
  'booking_history',
  'contact_type',
  'created_by',
];

const GUEST_STATUS = new Set(['active', 'vip', 'inactive', 'archived', 'blocked']);
const GUEST_CONTACT_TYPES = ['guest', 'customer'];

const asText = (value) => {
  const text = String(value ?? '').trim();
  return text || null;
};

const asEmail = (value) => {
  const email = String(value ?? '').trim().toLowerCase();
  return email || null;
};

const asPhone = (value) => {
  const phone = String(value ?? '').replace(/[^+\d()\-.\s]/g, '').replace(/\s+/g, ' ').trim();
  return phone || null;
};

const cleanArray = (value) => (Array.isArray(value) ? value : [])
  .map((item) => String(item ?? '').trim())
  .filter(Boolean);

function normalizeStatus(value) {
  const status = String(value || 'active').trim().toLowerCase().replace(/\s+/g, '_');
  return GUEST_STATUS.has(status) ? status : 'active';
}

function requireWorkspaceId(workspaceId) {
  const cleanWorkspaceId = asText(workspaceId);
  if (!cleanWorkspaceId) return { ok: false, result: { data: [], error: 'Select or create an active workspace before loading guests.', code: 'missing_workspace_id' } };
  return { ok: true, workspaceId: cleanWorkspaceId };
}

function notConfiguredResult(data = []) {
  return { data, error: null, code: 'supabase_not_configured', notConfigured: true, message: 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to load real guests.' };
}

function userSafeError(error, fallback) {
  const code = error?.code || '';
  const message = String(error?.message || error || '').toLowerCase();
  if (code === 'PGRST116') return 'Guest not found.';
  if (code === '42501' || message.includes('row-level security') || message.includes('permission denied')) return 'Your current workspace role cannot save this guest.';
  if (message.includes('violates check constraint')) return 'Guest contains an unsupported value.';
  if (message.includes('violates not-null constraint') || message.includes('null value')) return 'Guest is missing required fields.';
  if (message.includes('failed to fetch') || message.includes('network')) return 'Network issue while saving guest. Check your connection and try again.';
  return fallback;
}

export function normalizeGuest(row = null) {
  if (!row) return null;
  return {
    ...row,
    full_name: row.full_name || '',
    email: row.email || '',
    phone: row.phone || '',
    country: row.country || '',
    location: row.location || '',
    notes: row.notes || '',
    tags: cleanArray(row.tags),
    booking_history: cleanArray(row.booking_history),
    contact_type: GUEST_CONTACT_TYPES.includes(String(row.contact_type || '').toLowerCase()) ? String(row.contact_type).toLowerCase() : 'guest',
    status: normalizeStatus(row.status),
  };
}

export function buildGuestPayload(values = {}) {
  const payload = {};
  for (const key of GUEST_FIELDS) if (Object.prototype.hasOwnProperty.call(values, key)) payload[key] = values[key];

  if ('full_name' in payload) payload.full_name = asText(payload.full_name);
  if ('email' in payload) payload.email = asEmail(payload.email);
  if ('phone' in payload) payload.phone = asPhone(payload.phone);
  if ('country' in payload) payload.country = asText(payload.country);
  if ('location' in payload) payload.location = asText(payload.location);
  if ('notes' in payload) payload.notes = asText(payload.notes);
  if ('tags' in payload) payload.tags = cleanArray(payload.tags);
  if ('booking_history' in payload) payload.booking_history = cleanArray(payload.booking_history);
  if ('status' in payload) payload.status = normalizeStatus(payload.status);
  if ('created_by' in payload) payload.created_by = asText(payload.created_by);

  if ('contact_type' in payload) {
    const type = asText(payload.contact_type)?.toLowerCase();
    payload.contact_type = GUEST_CONTACT_TYPES.includes(type) ? type : 'guest';
  }

  return payload;
}

export async function listGuests({ workspaceId } = {}) {
  const w = requireWorkspaceId(workspaceId); if (!w.ok) return w.result;
  if (!isSupabaseConfigured || !supabase) return notConfiguredResult([]);
  const { data, error } = await supabase.from('contacts').select('*').eq('workspace_id', w.workspaceId).in('contact_type', GUEST_CONTACT_TYPES).order('updated_at', { ascending: false });
  if (error) return { data: [], error: userSafeError(error, 'Guests could not be loaded.'), code: error.code || 'guests_load_failed' };
  return { data: (data || []).map(normalizeGuest), error: null, code: 'ok' };
}

export async function getGuestById({ workspaceId, guestId } = {}) {
  const w = requireWorkspaceId(workspaceId); if (!w.ok) return { ...w.result, data: null };
  const id = asText(guestId); if (!id) return { data: null, error: 'Select a guest before loading details.', code: 'missing_guest_id' };
  if (!isSupabaseConfigured || !supabase) return notConfiguredResult(null);
  const { data, error } = await supabase.from('contacts').select('*').eq('workspace_id', w.workspaceId).in('contact_type', GUEST_CONTACT_TYPES).eq('id', id).single();
  if (error) return { data: null, error: userSafeError(error, 'Guest not found.'), code: error.code || 'guest_load_failed' };
  return { data: normalizeGuest(data), error: null, code: 'ok' };
}

export async function createGuest({ workspaceId, userId, values } = {}) {
  const w = requireWorkspaceId(workspaceId); if (!w.ok) return { ...w.result, data: null };
  if (!isSupabaseConfigured || !supabase) return notConfiguredResult(null);
  let payload;
  try { payload = buildGuestPayload(values); } catch (error) { return { data: null, error: error.message, code: 'invalid_guest_payload' }; }
  payload.workspace_id = w.workspaceId;
  payload.contact_type = 'guest';
  payload.created_by = asText(userId) || payload.created_by || null;

  const { data, error } = await supabase.from('contacts').insert(payload).select('*').single();
  if (error) return { data: null, error: userSafeError(error, 'Guest could not be saved.'), code: error.code || 'guest_insert_failed' };
  return { data: normalizeGuest(data), error: null, code: 'ok' };
}

export async function updateGuest({ workspaceId, guestId, values } = {}) {
  const w = requireWorkspaceId(workspaceId); if (!w.ok) return { ...w.result, data: null };
  const id = asText(guestId); if (!id) return { data: null, error: 'Select a guest before saving changes.', code: 'missing_guest_id' };
  if (!isSupabaseConfigured || !supabase) return notConfiguredResult(null);
  let payload;
  try { payload = buildGuestPayload(values); } catch (error) { return { data: null, error: error.message, code: 'invalid_guest_payload' }; }
  payload.contact_type = 'guest';

  const { data, error } = await supabase.from('contacts').update(payload).eq('id', id).eq('workspace_id', w.workspaceId).in('contact_type', GUEST_CONTACT_TYPES).select('*').single();
  if (error) return { data: null, error: userSafeError(error, 'Guest could not be updated.'), code: error.code || 'guest_update_failed' };
  return { data: normalizeGuest(data), error: null, code: 'ok' };
}
