import { isSupabaseConfigured } from './supabase.js';

const SENSITIVE_KEY_PATTERN = /(password|passcode|secret|token|api[_-]?key|apikey|authorization|auth|cookie|session|card|cvc|cvv|ssn|payload|provider)/i;
const MAX_STRING_LENGTH = 240;
const MAX_ARRAY_LENGTH = 20;
const MAX_DEPTH = 4;

function cleanScalar(value) {
  if (value === null || value === undefined) return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > MAX_STRING_LENGTH ? `${trimmed.slice(0, MAX_STRING_LENGTH)}…` : trimmed;
  }

  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;

  return null;
}

function sanitizeMetadataValue(value, depth = 0) {
  if (depth > MAX_DEPTH) return null;

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_LENGTH)
      .map((item) => sanitizeMetadataValue(item, depth + 1))
      .filter((item) => item !== undefined);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !SENSITIVE_KEY_PATTERN.test(key))
        .map(([key, item]) => [key, sanitizeMetadataValue(item, depth + 1)])
        .filter(([, item]) => item !== undefined),
    );
  }

  return cleanScalar(value);
}

export function sanitizeActivityMetadata(metadata = {}) {
  const sanitized = sanitizeMetadataValue(metadata);

  if (!sanitized || typeof sanitized !== 'object' || Array.isArray(sanitized)) {
    return {};
  }

  try {
    return JSON.parse(JSON.stringify(sanitized));
  } catch {
    return {};
  }
}

export async function logActivity({ supabase, workspaceId, actorUserId, action, metadata = {} } = {}) {
  if (!isSupabaseConfigured || !supabase || !workspaceId || !actorUserId || !action) {
    return { ok: false, skipped: true };
  }

  try {
    const { error } = await supabase.from('activity_logs').insert({
      workspace_id: workspaceId,
      actor_user_id: actorUserId,
      action: String(action).trim(),
      metadata: sanitizeActivityMetadata(metadata),
    });

    if (error) {
      console.warn('[PropFlow] Activity log write skipped', error);
      return { ok: false, skipped: true, error };
    }

    return { ok: true, skipped: false };
  } catch (error) {
    console.warn('[PropFlow] Activity log write skipped', error);
    return { ok: false, skipped: true, error };
  }
}
