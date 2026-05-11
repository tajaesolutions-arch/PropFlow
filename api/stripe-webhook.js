import { requireServerEnv } from './_utils/env.js';
import { json, requireMethod } from './_utils/http.js';

export default async function handler(request, response) {
  if (!requireMethod(request, response, 'POST')) return;

  if (!requireServerEnv(request, response, [{ name: 'STRIPE_SECRET_KEY' }, { name: 'STRIPE_WEBHOOK_SECRET' }])) return;

  return json(request, response, 501, {
    code: 'webhook_not_implemented',
    message: 'Stripe webhook signature verification and idempotent subscription persistence must be completed before this endpoint can process events.',
  });
}
