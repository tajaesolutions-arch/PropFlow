import { requireBearerToken } from './_utils/auth.js';
import { requireServerEnv } from './_utils/env.js';
import { json, requireJsonContentType, requireMethod } from './_utils/http.js';

export default async function handler(request, response) {
  if (!requireMethod(request, response, 'POST')) return;
  if (!requireJsonContentType(request, response)) return;
  if (!requireServerEnv(request, response, [{ name: 'SUPABASE_URL', fallbacks: ['VITE_SUPABASE_URL'] }, { name: 'SUPABASE_ANON_KEY', fallbacks: ['VITE_SUPABASE_ANON_KEY'] }])) return;
  if (!requireBearerToken(request, response, 'Authenticated session required before opening billing portal.')) return;

  return json(request, response, 501, {
    code: 'provider_not_configured',
    message: 'Stripe billing portal is not configured yet. Configure a server-side Stripe implementation before enabling portal redirects.',
    requiredServerEnv: ['STRIPE_SECRET_KEY'],
  });
}
