import { createClient } from '@supabase/supabase-js';

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const rawSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabaseUrl = rawSupabaseUrl?.trim?.() || '';
const supabaseAnonKey = rawSupabaseAnonKey?.trim?.() || '';

function isValidSupabaseUrl(value) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.includes('supabase');
  } catch {
    return false;
  }
}

function getPublicAppEnv() {
  const value = import.meta.env.VITE_APP_ENV?.trim?.() || 'local';
  return ['local', 'preview', 'staging', 'production'].includes(value) ? value : 'custom';
}

export const appEnvironment = getPublicAppEnv();

function getStorageConfiguredFlag() {
  const value = import.meta.env.VITE_SUPABASE_STORAGE_CONFIGURED?.trim?.().toLowerCase();
  return ['true', '1', 'yes'].includes(value);
}

export const isSupabaseStorageConfigured = getStorageConfiguredFlag();

export const supabaseSetupStatus = Object.freeze({
  hasUrl: Boolean(supabaseUrl),
  hasAnonKey: Boolean(supabaseAnonKey),
  hasValidUrl: isValidSupabaseUrl(supabaseUrl),
});

export const isSupabaseConfigured = Boolean(
  supabaseSetupStatus.hasValidUrl && supabaseSetupStatus.hasAnonKey,
);

if (!isSupabaseConfigured) {
  const missing = [
    !supabaseSetupStatus.hasUrl ? 'VITE_SUPABASE_URL' : '',
    !supabaseSetupStatus.hasAnonKey ? 'VITE_SUPABASE_ANON_KEY' : '',
    supabaseSetupStatus.hasUrl && !supabaseSetupStatus.hasValidUrl ? 'valid VITE_SUPABASE_URL' : '',
  ].filter(Boolean);

  console.warn(
    `[PropFlow] Supabase setup required. Missing or invalid public configuration: ${missing.join(', ') || 'unknown'}.`,
  );
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
