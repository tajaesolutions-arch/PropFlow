import { isSupabaseConfigured, supabase } from './supabase.js';

const OWNER_FIELDS = ['full_name','email','phone','company_name','payout_preference','notes','assigned_property_ids','status','user_id','account_id','contact_type','created_by'];
const STATUS_VALUES = new Set(['active','inactive','invited','archived']);

const asText = (value) => { const text = String(value ?? '').trim(); return text || null; };
const asEmail = (value) => { const email = String(value ?? '').trim().toLowerCase(); return email || null; };
const cleanArray = (value) => (Array.isArray(value) ? value : []).map((item) => String(item ?? '').trim()).filter(Boolean);

function requireWorkspaceId(workspaceId) {
  const cleanWorkspaceId = asText(workspaceId);
  if (!cleanWorkspaceId) return { ok: false, result: { data: [], error: 'Select or create an active workspace before loading owners.', code: 'missing_workspace_id' } };
  return { ok: true, workspaceId: cleanWorkspaceId };
}

function notConfiguredResult(data = []) {
  return { data, error: null, code: 'supabase_not_configured', notConfigured: true, message: 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to load real owners.' };
}

function userSafeError(error, fallback) {
  const code = error?.code || '';
  const message = String(error?.message || error || '').toLowerCase();
  if (code === 'PGRST116') return 'Owner not found.';
  if (code === '42501' || message.includes('row-level security') || message.includes('permission denied')) return 'Your current workspace role cannot save this owner.';
  if (message.includes('violates check constraint')) return 'Owner contains an unsupported value.';
  if (message.includes('violates not-null constraint') || message.includes('null value')) return 'Owner is missing required fields.';
  if (message.includes('failed to fetch') || message.includes('network')) return 'Network issue while saving owner. Check your connection and try again.';
  return fallback;
}

function normalizeStatus(value) {
  const status = String(value || 'active').trim().toLowerCase().replace(/\s+/g, '_');
  return STATUS_VALUES.has(status) ? status : 'active';
}

export function normalizeOwner(row = null) {
  if (!row) return null;
  return {
    ...row,
    full_name: row.full_name || '',
    email: row.email || '',
    phone: row.phone || '',
    company_name: row.company_name || '',
    payout_preference: row.payout_preference || '',
    notes: row.notes || '',
    status: normalizeStatus(row.status),
    assigned_property_ids: cleanArray(row.assigned_property_ids),
    user_id: row.user_id ?? null,
    account_id: row.account_id ?? null,
  };
}

export function buildOwnerPayload(values = {}) {
  const payload = {};
  for (const key of OWNER_FIELDS) if (Object.prototype.hasOwnProperty.call(values, key)) payload[key] = values[key];
  if ('full_name' in payload) payload.full_name = asText(payload.full_name);
  if ('email' in payload) payload.email = asEmail(payload.email);
  if ('phone' in payload) payload.phone = asText(payload.phone);
  if ('company_name' in payload) payload.company_name = asText(payload.company_name);
  if ('payout_preference' in payload) payload.payout_preference = asText(payload.payout_preference);
  if ('notes' in payload) payload.notes = asText(payload.notes);
  if ('assigned_property_ids' in payload) payload.assigned_property_ids = cleanArray(payload.assigned_property_ids);
  if ('status' in payload) payload.status = normalizeStatus(payload.status);
  if ('user_id' in payload) payload.user_id = asText(payload.user_id);
  if ('account_id' in payload) payload.account_id = asText(payload.account_id);
  if ('created_by' in payload) payload.created_by = asText(payload.created_by);
  if ('contact_type' in payload) payload.contact_type = asText(payload.contact_type) || 'owner';
  return payload;
}

export async function listOwners({ workspaceId } = {}) {
  const w = requireWorkspaceId(workspaceId); if (!w.ok) return w.result;
  if (!isSupabaseConfigured || !supabase) return notConfiguredResult([]);
  const { data, error } = await supabase.from('contacts').select('*').eq('workspace_id', w.workspaceId).eq('contact_type', 'owner').order('created_at', { ascending: false });
  if (error) return { data: [], error: userSafeError(error, 'Owners could not be loaded.'), code: error.code || 'owners_load_failed' };
  return { data: (data || []).map(normalizeOwner), error: null, code: 'ok' };
}

export async function getOwnerById({ workspaceId, ownerId } = {}) {
  const w = requireWorkspaceId(workspaceId); if (!w.ok) return { ...w.result, data: null };
  const id = asText(ownerId); if (!id) return { data: null, error: 'Select an owner before loading details.', code: 'missing_owner_id' };
  if (!isSupabaseConfigured || !supabase) return notConfiguredResult(null);
  const { data, error } = await supabase.from('contacts').select('*').eq('workspace_id', w.workspaceId).eq('contact_type', 'owner').eq('id', id).single();
  if (error) return { data: null, error: userSafeError(error, 'Owner not found.'), code: error.code || 'owner_load_failed' };
  return { data: normalizeOwner(data), error: null, code: 'ok' };
}

export async function createOwner({ workspaceId, userId, values } = {}) {
  const w = requireWorkspaceId(workspaceId); if (!w.ok) return { ...w.result, data: null };
  if (!isSupabaseConfigured || !supabase) return notConfiguredResult(null);
  let payload;
  try { payload = buildOwnerPayload(values); } catch (error) { return { data: null, error: error.message, code: 'invalid_owner_payload' }; }
  payload.workspace_id = w.workspaceId;
  payload.contact_type = 'owner';
  payload.created_by = asText(userId) || payload.created_by || null;
  const { data, error } = await supabase.from('contacts').insert(payload).select('*').single();
  if (error) return { data: null, error: userSafeError(error, 'Owner could not be saved.'), code: error.code || 'owner_insert_failed' };
  return { data: normalizeOwner(data), error: null, code: 'ok' };
}

export async function updateOwner({ workspaceId, ownerId, values } = {}) {
  const w = requireWorkspaceId(workspaceId); if (!w.ok) return { ...w.result, data: null };
  const id = asText(ownerId); if (!id) return { data: null, error: 'Select an owner before saving changes.', code: 'missing_owner_id' };
  if (!isSupabaseConfigured || !supabase) return notConfiguredResult(null);
  let payload;
  try { payload = buildOwnerPayload(values); } catch (error) { return { data: null, error: error.message, code: 'invalid_owner_payload' }; }
  payload.contact_type = 'owner';
  const { data, error } = await supabase.from('contacts').update(payload).eq('id', id).eq('workspace_id', w.workspaceId).eq('contact_type', 'owner').select('*').single();
  if (error) return { data: null, error: userSafeError(error, 'Owner could not be updated.'), code: error.code || 'owner_update_failed' };
  return { data: normalizeOwner(data), error: null, code: 'ok' };
}
