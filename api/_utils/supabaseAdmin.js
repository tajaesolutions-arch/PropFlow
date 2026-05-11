import { createClient } from '@supabase/supabase-js';

import { getServerEnv } from './env.js';

class ServerlessNoopWebSocket {
  constructor() {
    throw new Error('Realtime is disabled for PropFlow serverless admin clients.');
  }
}

export function getSupabaseAdminClient() {
  const supabaseUrl = getServerEnv('SUPABASE_URL', ['VITE_SUPABASE_URL']);
  const serviceRoleKey = getServerEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    realtime: {
      transport: ServerlessNoopWebSocket,
    },
  });
}

export async function getAuthenticatedUser(supabaseAdmin, accessToken) {
  if (!supabaseAdmin || !accessToken) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data?.user?.id) return null;
  return data.user;
}
